import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@frameflow/db";
import { audit } from "./audit";

// Razorpay over its REST API (no SDK): orders, payment lookup/capture and signature checks.
// Keys: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (Dashboard → Account & Settings → API keys),
// RAZORPAY_WEBHOOK_SECRET (Dashboard → Webhooks, URL <APP_URL>/api/razorpay/webhook).
const API = "https://api.razorpay.com/v1";

export const razorpayConfigured = () => !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID ?? "";

async function call<T>(method: "GET" | "POST", path: string, body?: object): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Basic ${auth}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new Error(`Razorpay ${method} ${path}: ${res.status} ${data.error?.description ?? ""}`.trim());
  return data;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; error_description?: string | null };

export const createOrder = (amountPaise: number, receipt: string, notes: Record<string, string>) =>
  call<RzpOrder>("POST", "/orders", { amount: amountPaise, currency: "INR", receipt, notes });

export const fetchPayment = (paymentId: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);

const capturePayment = (p: RzpPayment) => call<RzpPayment>("POST", `/payments/${encodeURIComponent(p.id)}/capture`, { amount: p.amount, currency: p.currency });

function hmacEquals(payload: string, secret: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

// The signature Checkout returns: HMAC-SHA256(order_id|payment_id, key secret).
export const checkoutSignatureOk = (orderId: string, paymentId: string, signature: string) =>
  hmacEquals(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET ?? "", signature);

// Webhooks sign the raw request body with the webhook secret.
export const webhookSignatureOk = (rawBody: string, signature: string) =>
  !!process.env.RAZORPAY_WEBHOOK_SECRET && hmacEquals(rawBody, process.env.RAZORPAY_WEBHOOK_SECRET, signature);

// Settles one of our orders from a Razorpay payment: checks it belongs to the order and pays its full
// amount, captures it if it was only authorized, then activates Pro. Safe to call more than once
// (Checkout's callback and the webhook both do): only the first call extends Pro.
export async function settlePayment(payment: RzpPayment): Promise<"paid" | "pending" | "failed" | "unknown"> {
  const prisma = db();
  const order = await prisma.payment.findUnique({ where: { orderId: payment.order_id } });
  if (!order) return "unknown";
  if (order.status === "paid") return "paid";
  if (payment.amount !== order.amount || payment.currency !== order.currency) {
    await prisma.payment.update({ where: { id: order.id }, data: { error: `amount mismatch: got ${payment.amount} ${payment.currency}` } });
    return "failed";
  }
  if (payment.status === "authorized") payment = await capturePayment(payment);
  if (payment.status === "failed") {
    await prisma.payment.updateMany({ where: { id: order.id, status: "created" }, data: { status: "failed", paymentId: payment.id, error: payment.error_description ?? "payment failed" } });
    return "failed";
  }
  if (payment.status !== "captured") return "pending";
  await activatePayment(order.orderId, payment.id);
  return "paid";
}

// Marks the order paid and extends the user's Pro by the order's days. Returns false if it was already paid.
async function activatePayment(orderId: string, paymentId: string): Promise<boolean> {
  return db().$transaction(async (tx) => {
    const now = new Date();
    const marked = await tx.payment.updateMany({ where: { orderId, status: { not: "paid" } }, data: { status: "paid", paymentId, paidAt: now, error: null } });
    if (marked.count !== 1) return false;
    const pay = await tx.payment.findUniqueOrThrow({ where: { orderId } });
    if (!pay.userId) return true; // the account was deleted after checkout started: keep the record, nothing to switch on
    // lock the user row so two payments at once both count
    await tx.$queryRaw`SELECT 1 FROM "User" WHERE "id" = ${pay.userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: pay.userId } });
    const unlimited = user.tier === "pro" && !user.proUntil; // given by an admin with no end date: keep it
    if (!unlimited) {
      const from = user.tier === "pro" && user.proUntil && user.proUntil > now ? user.proUntil : now;
      const proUntil = new Date(from.getTime() + pay.days * 24 * 3600 * 1000);
      await tx.user.update({ where: { id: user.id }, data: { tier: "pro", proUntil } });
    }
    await audit("payment.paid", `${pay.amount / 100} ${pay.currency} for ${pay.days} days of ${pay.plan} (${orderId}, ${paymentId})`, { targetId: user.id, tx });
    return true;
  });
}
