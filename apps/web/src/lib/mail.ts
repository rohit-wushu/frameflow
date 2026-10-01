import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "./site";

// Email over SMTP (any provider: Zoho, Gmail, Amazon SES, Brevo, ...). SMTP_URL looks like
// smtps://user:password@smtp.example.com:465. Without it, dev prints emails to the console instead.
const g = globalThis as unknown as { frameflowMail?: Transporter };

function transport(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  g.frameflowMail ??= nodemailer.createTransport(url);
  return g.frameflowMail;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// A short email with one button. `lines` are plain text paragraphs.
export async function sendMail(to: string, subject: string, lines: string[], button?: { label: string; url: string }): Promise<void> {
  const text = [...lines, ...(button ? [`${button.label}: ${button.url}`] : []), "", `${site.name} · ${site.url}`].join("\n\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111;max-width:480px">
${lines.map((l) => `<p>${esc(l)}</p>`).join("\n")}
${button ? `<p><a href="${esc(button.url)}" style="display:inline-block;background:#6d4aff;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${esc(button.label)}</a></p><p style="font-size:12px;color:#666">Or open this link: ${esc(button.url)}</p>` : ""}
<p style="font-size:12px;color:#666">${esc(site.name)} · <a href="${esc(site.url)}">${esc(site.url)}</a></p></div>`;

  const t = transport();
  if (!t) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_URL is not set, so emails can't be sent");
    console.log(`[mail] to ${to}: ${subject}\n${text}`);
    return;
  }
  await t.sendMail({ from: process.env.MAIL_FROM || `${site.name} <${site.contactEmail}>`, to, subject, text, html });
}
