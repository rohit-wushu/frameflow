import { db, effectiveTier, limitsFor, usageFor } from "@frameflow/db";
import Link from "next/link";
import { BuyProButton } from "@/components/buy-pro-button";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth";
import { razorpayConfigured } from "@/lib/razorpay";
import { inr, proOffer } from "@/lib/site";

export const metadata = { title: "Billing" };

const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function BillingPage() {
  const user = await requireUser();
  const prisma = db();
  const [usage, payments] = await Promise.all([
    usageFor(prisma, user),
    prisma.payment.findMany({ where: { userId: user.id, status: { not: "created" } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const tier = effectiveTier(user);
  const offer = proOffer();
  const pro = limitsFor("pro");
  const expired = user.tier === "pro" && tier === "free";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">Your plan, what you&apos;ve used this month, and your payments.</p>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{tier === "pro" ? "Pro" : "Free"} plan</h2>
          {tier === "pro" && <Badge>{user.proUntil ? `until ${day(user.proUntil)}` : "no end date"}</Badge>}
          {expired && user.proUntil && <Badge variant="secondary">Pro ended {day(user.proUntil)}</Badge>}
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Renders this month</dt>
            <dd className="mt-1 text-xl font-semibold">
              {usage.renders} <span className="text-sm font-normal text-muted-foreground">of {usage.rendersLimit}</span>
            </dd>
            <dd className="text-xs text-muted-foreground">Resets {day(usage.resetsOn)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">AI requests, last 24 hours</dt>
            <dd className="mt-1 text-xl font-semibold">
              {usage.aiCalls} <span className="text-sm font-normal text-muted-foreground">of {usage.aiCallsLimit}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-2xl border border-primary/30 bg-[linear-gradient(160deg,color-mix(in_oklch,var(--brand-violet),transparent_88%),transparent_60%)] p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">{tier === "pro" ? "Add more Pro time" : "Upgrade to Pro"}</h2>
          <div>
            <span className="text-3xl font-semibold">₹{offer.priceInr.toLocaleString("en-IN")}</span>
            <span className="text-sm text-muted-foreground"> / {offer.days} days</span>
          </div>
        </div>
        <ul className="space-y-1.5 text-sm text-foreground/85">
          <li>• {pro.rendersPerMonth} renders a month (instead of {limitsFor("free").rendersPerMonth})</li>
          <li>• {pro.aiCallsPerDay} AI director requests a day</li>
          <li>• One payment, no auto-renewal. {tier === "pro" ? `Adds ${offer.days} days to your current Pro.` : `Pro starts right away.`}</li>
          <li>• UPI, cards, netbanking and wallets through Razorpay</li>
        </ul>
        {razorpayConfigured() ? (
          <BuyProButton label={tier === "pro" ? `Add ${offer.days} days` : "Upgrade to Pro"} />
        ) : (
          <p className="text-sm text-muted-foreground">Payments are not set up yet. Check back soon.</p>
        )}
        <p className="text-xs text-muted-foreground">
          By paying you agree to the <Link href="/terms" className="underline underline-offset-2">Terms</Link> and{" "}
          <Link href="/refunds" className="underline underline-offset-2">Refund Policy</Link>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Payments</h2>
        {!payments.length ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">What</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 whitespace-nowrap">{day(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-2.5">Pro, {p.days} days</td>
                    <td className="px-4 py-2.5">{inr(p.amount)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={p.status === "paid" ? "default" : "destructive"}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.paymentId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
