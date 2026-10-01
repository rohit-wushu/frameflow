import { db, effectiveTier, type Prisma } from "@frameflow/db";
import { Search } from "lucide-react";
import Link from "next/link";
import { ago, date, Filters, PageTitle, Pager, pageParam, str, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { istBoundaries } from "@/lib/admin-stats";
import { isAdmin, requireAdmin } from "@/lib/auth";

export const metadata = { title: "Users" };

const PER_PAGE = 50;
const FILTERS = [
  { value: "", label: "All" },
  { value: "pro", label: "Pro" },
  { value: "free", label: "Free" },
  { value: "unverified", label: "Unconfirmed email" },
  { value: "disabled", label: "Disabled" },
  { value: "admin", label: "Admins" },
];

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 100);
  const plan = str(sp.plan);
  const page = pageParam(sp.page);
  const now = new Date();
  const proActive: Prisma.UserWhereInput = { tier: "pro", OR: [{ proUntil: null }, { proUntil: { gt: now } }] };
  const filter: Record<string, Prisma.UserWhereInput> = {
    pro: proActive,
    free: { NOT: proActive },
    unverified: { emailVerifiedAt: null },
    disabled: { disabledAt: { not: null } },
    admin: { role: "admin" },
  };
  const where: Prisma.UserWhereInput = {
    AND: [
      q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { id: q }] } : {},
      filter[plan] ?? {},
    ],
  };
  const prisma = db();
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE + 1,
      select: { id: true, name: true, email: true, role: true, tier: true, proUntil: true, emailVerifiedAt: true, disabledAt: true, lastLoginAt: true, createdAt: true, _count: { select: { projects: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const shown = users.slice(0, PER_PAGE);
  const ids = shown.map((u) => u.id);
  const { month } = istBoundaries(now);
  const [renders, paid] = await Promise.all([
    prisma.job.groupBy({ by: ["userId"], where: { userId: { in: ids }, kind: "render", status: { not: "failed" }, createdAt: { gte: month } }, _count: true }),
    prisma.payment.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "paid" }, _sum: { amount: true } }),
  ]);
  const rendersBy = new Map(renders.map((r) => [r.userId, r._count]));
  const paidBy = new Map(paid.map((p) => [p.userId, p._sum.amount ?? 0]));
  const keep = { ...(q ? { q } : {}), ...(plan ? { plan } : {}) };

  return (
    <>
      <PageTitle title="Users" text={`${total} ${total === 1 ? "user" : "users"}${q || plan ? " match" : ""}`}>
        <form className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          {plan && <input type="hidden" name="plan" value={plan} />}
          <Input name="q" defaultValue={q} placeholder="Search name, email or id" className="h-9 pl-9" />
        </form>
      </PageTitle>
      <Filters base="/admin/users" param="plan" options={FILTERS} current={plan} keep={q ? { q } : undefined} />
      <Table head={["User", "Plan", "Renders this month", "Videos", "Paid", "Joined", "Last login"]} empty="No users match.">
        {shown.map((u) => {
          const tier = effectiveTier(u, now);
          const spent = paidBy.get(u.id) ?? 0;
          return (
            <tr key={u.id} className={u.disabledAt ? "opacity-60" : undefined}>
              <td>
                <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                  {u.name}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {u.email}
                  {!u.emailVerifiedAt && <Badge variant="outline">unconfirmed</Badge>}
                  {u.disabledAt && <Badge variant="destructive">disabled</Badge>}
                  {isAdmin(u) && <Badge variant="secondary">admin</Badge>}
                </div>
              </td>
              <td className="whitespace-nowrap">
                {tier === "pro" ? <Badge>Pro</Badge> : <span className="text-muted-foreground">Free</span>}
                {tier === "pro" && <div className="text-xs text-muted-foreground">{u.proUntil ? `until ${date(u.proUntil)}` : "no end"}</div>}
              </td>
              <td>{rendersBy.get(u.id) ?? 0}</td>
              <td>{u._count.projects}</td>
              <td className="whitespace-nowrap">{spent ? `₹${(spent / 100).toLocaleString("en-IN")}` : <span className="text-muted-foreground">—</span>}</td>
              <td className="whitespace-nowrap text-muted-foreground">{date(u.createdAt)}</td>
              <td className="whitespace-nowrap text-muted-foreground">{u.lastLoginAt ? ago(u.lastLoginAt) : "—"}</td>
            </tr>
          );
        })}
      </Table>
      <Pager base="/admin/users" page={page} hasNext={users.length > PER_PAGE} keep={keep} />
    </>
  );
}
