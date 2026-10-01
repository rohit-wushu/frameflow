import { ContactLink, LegalPage, Operator } from "@/components/legal";
import { site } from "@/lib/site";

export const metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what personal data {site.name} collects, why, and what you can do about it. <Operator />, which is responsible for
        your data under India&apos;s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email address and a scrambled (hashed) version of your password. We never store your password
          itself.
        </li>
        <li>
          <strong>What you make:</strong> prompts, website addresses, logos and images you upload, brand kits, storyboards, chat edits and the
          videos we render.
        </li>
        <li>
          <strong>Payments:</strong> the amount, date and Razorpay order and payment IDs. Card, UPI and bank details go to Razorpay, not to us.
        </li>
        <li>
          <strong>Technical data:</strong> a login cookie, your IP address (used for rate limits against abuse) and logs of jobs and errors.
        </li>
      </ul>
      <p>We don&apos;t use advertising or tracking cookies, and we don&apos;t sell your data.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>to run your account and make your videos;</li>
        <li>to send emails you need: confirming your address, resetting your password, and receipts or notices about your account;</li>
        <li>to enforce plan limits and stop abuse;</li>
        <li>to fix problems and improve the Service.</li>
      </ul>

      <h2>Who else handles it</h2>
      <ul>
        <li>
          <strong>Anthropic</strong> (AI provider): your prompt, brand details, website text and chat edits are sent to write and revise the
          script. Under its commercial terms, Anthropic does not train its models on this data.
        </li>
        <li>
          <strong>Razorpay</strong>: processes payments.
        </li>
        <li>
          <strong>Our email provider</strong>: delivers account emails.
        </li>
        <li>
          <strong>Our hosting provider</strong>: stores the database and files.
        </li>
        <li>
          <strong>Websites you give us</strong>: when you enter a website, our server visits it like a browser to read its text, colours and
          logo.
        </li>
      </ul>
      <p>
        Our own staff can see your account, projects and videos only to give support, investigate abuse or fix problems. We may also share
        data when the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and videos while your account is open. When you ask us to delete your account we delete your projects, uploads
        and videos within 30 days. We keep payment records as long as tax law requires (usually 8 years).
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal data, or withdraw consent, by writing to <ContactLink />. We reply within 30 days. If
        you are not satisfied, you can complain to the Data Protection Board of India.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with scrypt, login tokens are stored only as hashes, files are only served to their owner, and connections use
        HTTPS. No system is perfectly secure; if a breach affects you, we will tell you and the authorities as the law requires.
      </p>

      <h2>Children</h2>
      <p>The Service is not meant for children under 18 without a parent&apos;s or guardian&apos;s consent.</p>

      <h2>Changes</h2>
      <p>We will post changes here and, if they are significant, tell you by email.</p>

      <h2>Contact / Grievance officer</h2>
      <p>
        {site.legalName}
        {site.address ? `, ${site.address}` : ""}. Email: <ContactLink />.
      </p>
    </LegalPage>
  );
}
