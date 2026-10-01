import type { NextRequest } from "next/server";
import { settlePayment, webhookSignatureOk, type RzpPayment } from "@/lib/razorpay";

// Razorpay webhook (Dashboard → Webhooks: URL <APP_URL>/api/razorpay/webhook, events payment.captured,
// payment.failed, order.paid; secret = RAZORPAY_WEBHOOK_SECRET). The source of truth for payments:
// it settles orders whose browser callback never arrived. Settling is idempotent, so repeats are fine.
export async function POST(req: NextRequest) {
  const body = await req.text();
  if (!webhookSignatureOk(body, req.headers.get("x-razorpay-signature") ?? "")) return Response.json({ error: "bad signature" }, { status: 400 });
  const event = JSON.parse(body) as { event: string; payload?: { payment?: { entity?: RzpPayment } } };
  const payment = event.payload?.payment?.entity;
  if (payment?.order_id && ["payment.captured", "payment.failed", "payment.authorized", "order.paid"].includes(event.event)) {
    try {
      await settlePayment(payment);
    } catch (e) {
      console.error(`razorpay webhook ${event.event} for ${payment.id} failed:`, e);
      return Response.json({ error: "try again" }, { status: 500 }); // Razorpay retries
    }
  }
  return Response.json({ ok: true });
}
