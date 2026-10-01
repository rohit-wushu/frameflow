import { ContactLink, LegalPage, Operator } from "@/components/legal";
import { proOffer, site } from "@/lib/site";

export const metadata = { title: "Refund & Cancellation Policy" };

export default function Refunds() {
  const pro = proOffer();
  return (
    <LegalPage title="Refund & Cancellation Policy">
      <p>
        <Operator />. This policy covers the {site.name} Pro pass.
      </p>

      <h2>What you buy</h2>
      <p>
        The Pro pass is a one-time payment of ₹{pro.priceInr.toLocaleString("en-IN")} for {pro.days} days of Pro limits. It is a digital service
        that starts as soon as the payment succeeds; nothing is shipped.
      </p>

      <h2>Cancellation</h2>
      <p>
        The pass does not renew automatically, so there is nothing to cancel: when the {pro.days} days end, your account goes back to the Free
        plan. Your videos stay in your account.
      </p>

      <h2>Refunds</h2>
      <ul>
        <li>
          <strong>Within 7 days of payment</strong>, if you have used 3 renders or fewer on Pro, you can ask for a full refund.
        </li>
        <li>
          <strong>Charged twice, or charged but Pro didn&apos;t start:</strong> we refund the extra or failed payment in full.
        </li>
        <li>
          <strong>The Service didn&apos;t work</strong> (for example renders kept failing on our side and we couldn&apos;t fix it): we refund in
          full or in part, depending on how much of the pass you could use.
        </li>
        <li>Otherwise, passes that have been used are not refundable.</li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Email <ContactLink /> from your account&apos;s email address with the payment date and Razorpay payment ID (shown on the Billing page). We
        reply within 3 working days. Approved refunds go back to the original payment method through Razorpay, usually within 5–7 working
        days.
      </p>
    </LegalPage>
  );
}
