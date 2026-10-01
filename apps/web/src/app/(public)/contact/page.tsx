import { Mail, MapPin, Phone } from "lucide-react";
import { ContactLink } from "@/components/legal";
import { site } from "@/lib/site";

export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Contact us</h1>
        <p className="text-muted-foreground">Questions about your account, a payment or a refund? We usually reply within 1–2 working days.</p>
      </header>
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-card p-6 text-[0.95rem]">
        <div className="font-medium">{site.legalName}</div>
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-4 text-muted-foreground" />
          <span className="[&_a]:underline [&_a]:underline-offset-4">
            <ContactLink />
          </span>
        </div>
        {site.phone && (
          <div className="flex items-start gap-3">
            <Phone className="mt-0.5 size-4 text-muted-foreground" />
            <a href={`tel:${site.phone.replace(/\s+/g, "")}`}>{site.phone}</a>
          </div>
        )}
        {site.address && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-4 text-muted-foreground" />
            <span>{site.address}</span>
          </div>
        )}
      </div>
    </div>
  );
}
