import { db, effectiveTier, usageFor } from "@frameflow/db";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ago, date, dateTime, Section, Table } from "@/components/admin/ui";
import { AccountControls, DeleteUser, PlanControls } from "@/components/admin/user-actions";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { isAdmin, requireAdmin } from "@/lib/auth";
import { inr } from "@/lib/site";

export const metadata = { title: "User" };

export default async function AdminUser({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const prisma = db();
  const user = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { projects: true, brandKits: true, batches: true, sessions: true } } } });
  if (!user) notFound();
  const [usage, payments, projects, jobs, log, failed] = await Promise.all([
    usageFor(prisma, user),
    prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.project.findMany({ where: { userId: id }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true, status: true, format: true, durationSec: true, currentVersion: true, updatedAt: true } }),
    prisma.job.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { project: { select: { title: true } } } }),
    prisma.auditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.job.count({ where: { userId: id, status: "failed" } }),
  ]);
  const tier = effectiveTier(user);
  const paidTotal = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const target = {
    id: user.id,
    email: user.email,
    tier: tier as "free" | "pro",
    proForever: user.tier === "pro" && !user.proUntil,
    verified: !!user.emailVerifiedAt,
    disabled: !!user.disabledAt,
    admin: isAdmin(user),
    self: user.id === admin.id,
  };
  const actors = new Map((await prisma.user.findMany({ where: { id: { in: log.map((l) => l.actorId).filter((a): a is string => !!a) } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Users
      </Link>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          {tier === "pro" ? <Badge>Pro</Badge> : <Badge variant="secondary">Free</Badge>}
          {target.admin && <Badge variant="secondary">admin</Badge>}
          {!user.emailVerifiedAt && <Badge variant="outline">email unconfirmed</Badge>}
          {user.disabledAt && <Badge variant="destructive">disabled {date(user.disabledAt)}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {user.email} · joined {dateTime(user.createdAt)} · last login {user.lastLoginAt ? ago(user.lastLoginAt) : "never"} · {user._count.sessions} active
          sessions · <span className="font-mono text-xs">{user.id}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Plan" value={tier === "pro" ? "Pro" : "Free"} note={tier === "pro" ? (user.proUntil ? `until ${dateTime(user.proUntil)}` : "no end date") : user.proUntil ? `Pro ended ${date(user.proUntil)}` : undefined} />
        <Info label="Renders this month" value={`${usage.renders} / ${usage.rendersLimit}`} note={`AI requests today ${usage.aiCalls} / ${usage.aiCallsLimit}`} />
        <Info label="Paid in total" value={inr(paidTotal)} note={`${payments.filter((p) => p.status === "paid").length} payments`} />
        <Info label="Videos" value={String(user._count.projects)} note={`${user._count.brandKits} brand kits · ${user._count.batches} batches · ${failed} failed jobs`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Plan">
          <PlanControls user={target} />
        </Panel>
        <Panel title="Account">
          <AccountControls user={target} />
          <div className="mt-4 border-t pt-4">
            <DeleteUser user={target} />
          </div>
        </Panel>
      </div>

      <Section title="Payments">
        <Table head={["Created", "Amount", "Days", "Status", "Order / payment", "Note"]} empty="No payments.">
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap text-muted-foreground">{dateTime(p.createdAt)}</td>
              <td>{inr(p.amount)}</td>
              <td>{p.days}</td>
              <td>
                <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"}>{p.status === "created" ? "not paid" : p.status}</Badge>
              </td>
              <td className="font-mono text-xs text-muted-foreground">
                {p.orderId}
                <br />
                {p.paymentId ?? "—"}
              </td>
              <td className="max-w-56 truncate text-xs text-muted-foreground" title={p.error ?? ""}>
                {p.error ?? ""}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Videos" action={<Link href={`/admin/projects?user=${user.id}`} className="text-xs text-muted-foreground hover:text-foreground">All →</Link>}>
        <Table head={["Title", "Status", "Format", "Versions", "Updated"]} empty="No videos.">
          {projects.map((p) => (
            <tr key={p.id}>
              <td className="max-w-72 truncate">
                <Link href={`/admin/projects/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
              </td>
              <td>
                <StatusBadge status={p.status} />
              </td>
              <td className="whitespace-nowrap text-muted-foreground">
                {p.format} · {p.durationSec}s
              </td>
              <td>{p.currentVersion ?? "—"}</td>
              <td className="whitespace-nowrap text-muted-foreground">{ago(p.updatedAt)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Recent jobs">
        <Table head={["When", "Kind", "Video", "Status", "Error"]} empty="No jobs.">
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="whitespace-nowrap text-muted-foreground">{ago(j.createdAt)}</td>
              <td>{j.kind}</td>
              <td className="max-w-56 truncate">{j.project.title}</td>
              <td>
                <Badge variant={j.status === "failed" ? "destructive" : j.status === "done" ? "secondary" : "outline"}>{j.status}</Badge>
              </td>
              <td className="max-w-sm truncate text-xs text-destructive" title={j.error ?? ""}>
                {j.error ?? ""}
              </td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section title="Activity on this account">
        <Table head={["When", "Who", "What"]} empty="Nothing logged yet.">
          {log.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-muted-foreground">{dateTime(l.createdAt)}</td>
              <td className="text-muted-foreground">{l.actorId ? (actors.get(l.actorId) ?? "deleted admin") : "system"}</td>
              <td>{l.detail}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}

function Info({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {note && <div className="mt-0.5 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
