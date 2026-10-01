import Link from "next/link";
import { cn } from "@/lib/utils";

// Small building blocks shared by the admin pages.

export const dateTime = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const date = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export function ago(d: Date): string {
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return date(d);
}

export function PageTitle({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {text && <p className="text-sm text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, note, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </>
  );
  const cls = "block rounded-xl border bg-card p-4";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-primary/40")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// A scrollable table. `head` are the column titles; rows are <Tr>s.
export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean).length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-left text-xs text-muted-foreground">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-t">{children}</tbody>
      </table>
      {!rows && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{empty ?? "Nothing here yet."}</p>}
    </div>
  );
}

// Filter chips that set one search param (e.g. ?status=failed), keeping the others.
export function Filters({ base, param, options, current, keep }: { base: string; param: string; options: { value: string; label: string }[]; current: string; keep?: Record<string, string> }) {
  const href = (v: string) => {
    const q = new URLSearchParams({ ...keep, ...(v ? { [param]: v } : {}) });
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Link
          key={o.value}
          href={href(o.value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs ring-1 transition",
            current === o.value ? "bg-primary/20 text-foreground ring-primary/40" : "text-muted-foreground ring-white/10 hover:text-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

export function Pager({ base, page, hasNext, keep }: { base: string; page: number; hasNext: boolean; keep?: Record<string, string> }) {
  const href = (p: number) => `${base}?${new URLSearchParams({ ...keep, page: String(p) })}`;
  if (page === 1 && !hasNext) return null;
  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      {page > 1 && (
        <Link href={href(page - 1)} className="text-muted-foreground hover:text-foreground">
          ← Newer
        </Link>
      )}
      <span className="text-muted-foreground">Page {page}</span>
      {hasNext && (
        <Link href={href(page + 1)} className="text-muted-foreground hover:text-foreground">
          Older →
        </Link>
      )}
    </div>
  );
}

// ?page=N, clamped to 1..1000
export const pageParam = (v: unknown) => Math.min(1000, Math.max(1, Math.floor(Number(v)) || 1));
export const str = (v: unknown) => (typeof v === "string" ? v : "");
