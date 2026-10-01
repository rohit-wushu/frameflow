// Business details shown on the legal pages, in emails and on Razorpay's checkout. All from .env.
export const site = {
  name: "Frameflow",
  url: (process.env.APP_URL ?? "http://localhost:3210").replace(/\/+$/, ""),
  legalName: process.env.LEGAL_NAME || "Frameflow",
  address: process.env.LEGAL_ADDRESS || "",
  contactEmail: process.env.CONTACT_EMAIL || "support@example.com",
  phone: process.env.CONTACT_PHONE || "",
  // courts named in the terms
  jurisdiction: process.env.LEGAL_JURISDICTION || "India",
  updated: "1 October 2026",
};

// The Pro pass: one payment buys PRO_DAYS of Pro. No auto-renewal.
export function proOffer() {
  const num = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return { priceInr: num("PRO_PRICE_INR", 999), days: Math.round(num("PRO_DAYS", 30)) };
}

export const inr = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
