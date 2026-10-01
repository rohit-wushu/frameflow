"use server";
import { db } from "@frameflow/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { allow } from "@/lib/rate-limit";
import { checkoutSignatureOk, createOrder, fetchPayment, razorpayConfigured, razorpayKeyId, settlePayment } from "@/lib/razorpay";
import { proOffer, site } from "@/lib/site";

export type CheckoutOrder =
  | { ok: true; keyId: string; orderId: string; amount: number; currency: string; name: string; description: string; prefill: { name: string; email: string } }
  | { ok: false; error: string };

// Step 1: make a Razorpay order for one Pro pass. The browser then opens Razorpay Checkout with it.
export async function startProCheckout(): Promise<CheckoutOrder> {
  const user = await requireUser();
  if (!razorpayConfigured()) return { ok: false, error: "Payments are not set up yet. Please try again later." };
  if (!user.emailVerifiedAt) return { ok: false, error: "Confirm your email first: open the link we sent you." };
  if (!(await allow(`checkout:${user.id}`, 10, 3600))) return { ok: false, error: "Too many attempts; try again in a while." };
  const { priceInr, days } = proOffer();
  const amount = Math.round(priceInr * 100);
  let order;
  try {
    order = await createOrder(amount, `ff_${user.id.slice(-12)}_${Date.now().toString(36)}`, { userId: user.id, plan: "pro", days: String(days) });
  } catch (e) {
    console.error("razorpay order failed:", e);
    return { ok: false, error: "Couldn't start the payment. Please try again." };
  }
  await db().payment.create({ data: { userId: user.id, orderId: order.id, amount, currency: order.currency, plan: "pro", days } });
  return {
    ok: true,
    keyId: razorpayKeyId(),
    orderId: order.id,
    amount,
    currency: order.currency,
    name: site.name,
    description: `Pro for ${days} days`,
    prefill: { name: user.name, email: user.email },
  };
}

export type CheckoutResult = { ok: true; status: "paid" | "pending" } | { ok: false; error: string };

// Step 2: Checkout's success callback. The signature proves the payment is for our order; we still ask
// Razorpay for the payment itself (amount, captured) before giving Pro. The webhook does the same,
// so Pro starts even if this request never arrives (closed tab, lost network).
export async function confirmProPayment(input: { orderId: string; paymentId: string; signature: string }): Promise<CheckoutResult> {
  const user = await requireUser();
  const order = await db().payment.findUnique({ where: { orderId: String(input.orderId) } });
  if (!order || order.userId !== user.id) return { ok: false, error: "We couldn't find this payment." };
  if (!checkoutSignatureOk(order.orderId, String(input.paymentId), String(input.signature))) return { ok: false, error: "The payment could not be verified." };
  let status;
  try {
    const payment = await fetchPayment(String(input.paymentId));
    if (payment.order_id !== order.orderId) return { ok: false, error: "The payment could not be verified." };
    status = await settlePayment(payment);
  } catch (e) {
    console.error(`confirming payment ${input.paymentId} failed:`, e);
    // the webhook will settle it
    return { ok: true, status: "pending" };
  }
  revalidatePath("/", "layout");
  if (status === "paid") return { ok: true, status: "paid" };
  if (status === "pending") return { ok: true, status: "pending" };
  return { ok: false, error: "The payment didn't go through. If money was taken, it will be refunded automatically." };
}

// Checkout closed or the payment failed in the browser: keep the order (a late success can still settle it).
export async function cancelProCheckout(orderId: string, reason: string) {
  const user = await requireUser();
  await db().payment.updateMany({ where: { orderId: String(orderId), userId: user.id, status: "created" }, data: { error: String(reason).slice(0, 300) } });
}
