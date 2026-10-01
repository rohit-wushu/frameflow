import { db } from "@frameflow/db";
import Link from "next/link";
import { ago, PageTitle, Section, Stat, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { daily, overview } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { inr } from "@/lib/site";

export const metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const prisma = db();
  const [o, days, signups, payments, failures] = await Promise.all([
    overview(),
    daily(14),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, createdAt: true, emailVerifiedAt: true } }),
    prisma.payment.findMany({ where: { status: "paid" }, orderBy: { paidAt: "desc" }, take: 8, include: { user: { select: { id: true, email: true } } } }),
    prisma.job.findMany({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, take: 8, include: { user: { select: { email: true } }, project: { select: { title: true } } } }),
  ]);

  return (
    <>
      <PageTitle title="Overview" text="Days and months are counted in India time." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue this month" value={inr(o.revenue.month.paise)} note={`${o.revenue.month.count} payments · all time ${inr(o.revenue.all.paise)}`} href="/admin/payments" />
        <Stat label="Pro users now" value={o.users.pro} note={`of ${o.users.total} users`} href="/admin/users?plan=pro" />
        <Stat label="Users" value={o.users.total} note={`+${o.users.today} today · +${o.users.week} in 7 days · +${o.users.month} this month`} href="/admin/users" />
        <Stat label="Renders" value={o.renders.today} note={`today · ${o.renders.month} this month`} href="/admin/jobs?kind=render" />
        <Stat label="Jobs working now" value={o.jobsNow.running} note={`${o.jobsNow.queued} waiting in the queue`} href="/admin/jobs?status=running" />
        <Stat label="Failed jobs, last 24 h" value={<span className={o.failed24h ? "text-destructive" : undefined}>{o.failed24h}</span>} href="/admin/jobs?status=failed" />
        <Stat label="AI requests today" value={o.aiToday} note="new scripts and chat edits" />
        <Stat label="Videos" value={o.projects} note={`${o.readyVideos} finished renders · ${o.users.unverified} unconfirmed emails · ${o.users.disabled} disabled`} href="/admin/projects" />
      </div>

      <Section title="Last 14 days">
        <Table head={["Day", "Sign-ups", "Renders", "Failed jobs", "Revenue"]}>
          {days.map((d) => (
            <tr key={d.day}>
              <td className="whitespace-nowrap">{d.day}</td>
              <td>{d.signups || <span className="text-muted-foreground">0</span>}</td>
              <td>{d.renders || <span className="text-muted-foreground">0</span>}</td>
              <td className={d.failed ? "text-destructive" : "text-muted-foreground"}>{d.failed}</td>
              <td>{d.revenue ? inr(d.revenue) : <span className="text-muted-foreground">—</span>}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="New users" action={<Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground">All users →</Link>}>
          <Table head={["User", "Email", "Joined"]} empty="No users yet.">
            {signups.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="hover:underline">
                    {u.name}
                  </Link>
                </td>
                <td className="text-muted-foreground">
                  {u.email} {!u.emailVerifiedAt && <Badge variant="outline">unconfirmed</Badge>}
                </td>
                <td className="whitespace-nowrap text-muted-foreground">{ago(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </Section>

        <Section title="Latest payments" action={<Link href="/admin/payments" className="text-xs text-muted-foreground hover:text-foreground">All payments →</Link>}>
          <Table head={["User", "Amount", "Paid"]} empty="No payments yet.">
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{p.user ? <Link href={`/admin/users/${p.user.id}`} className="hover:underline">{p.user.email}</Link> : <span className="text-muted-foreground">deleted user</span>}</td>
                <td>{inr(p.amount)}</td>
                <td className="whitespace-nowrap text-muted-foreground">{p.paidAt ? ago(p.paidAt) : "—"}</td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>

      <Section title="Latest failures" action={<Link href="/admin/jobs?status=failed" className="text-xs text-muted-foreground hover:text-foreground">All failed jobs →</Link>}>
        <Table head={["When", "Kind", "Video", "User", "Error"]} empty="No failed jobs.">
          {failures.map((j) => (
            <tr key={j.id}>
              <td className="whitespace-nowrap text-muted-foreground">{ago(j.updatedAt)}</td>
              <td>{j.kind}</td>
              <td className="max-w-48 truncate">
                <Link href={`/admin/projects/${j.projectId}`} className="hover:underline">
                  {j.project.title}
                </Link>
              </td>
              <td className="text-muted-foreground">{j.user.email}</td>
              <td className="max-w-md truncate text-destructive" title={j.error ?? ""}>
                {j.step ? `${j.step}: ` : ""}
                {j.error ?? "—"}
              </td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
