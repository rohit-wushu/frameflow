"use client";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cancelProCheckout, confirmProPayment, startProCheckout } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";

type RzpResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RzpInstance = { open(): void; on(event: "payment.failed", cb: (r: { error: { description?: string } }) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: object) => RzpInstance;
  }
}

// Razorpay's Checkout script, loaded once when the button is first used.
function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function BuyProButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    const order = await startProCheckout();
    if (!order.ok) {
      toast.error(order.error);
      return setBusy(false);
    }
    if (!(await loadCheckout())) {
      toast.error("Couldn't load the payment window. Check your connection or ad blocker and try again.");
      return setBusy(false);
    }
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: "#6d4aff" },
      handler: async (r: RzpResponse) => {
        const res = await confirmProPayment({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        if (!res.ok) toast.error(res.error);
        else if (res.status === "paid") toast.success("You're on Pro. Thank you!");
        else toast.message("Payment received. Pro will switch on in a minute.");
        setBusy(false);
        router.refresh();
      },
      modal: {
        ondismiss: () => {
          void cancelProCheckout(order.orderId, "checkout closed");
          setBusy(false);
        },
      },
    });
    rzp.on("payment.failed", (r) => void cancelProCheckout(order.orderId, r.error.description ?? "payment failed"));
    rzp.open();
  }

  return (
    <Button size="lg" onClick={buy} disabled={busy} className="w-full sm:w-auto">
      {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
      {busy ? "Opening payment…" : label}
    </Button>
  );
}
