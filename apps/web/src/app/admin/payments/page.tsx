import { db, type Prisma } from "@frameflow/db";
import Link from "next/link";
import { dateTime, Filters, PageTitle, Pager, pageParam, Stat, str, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { istBoundaries } from "@/lib/admin-stats";
import { requireAdmin } from "@/lib/auth";
import { inr } from "@/lib/site";

export const metadata = { title: "Payments" };

const PER_PAGE = 50;
const STATUSES = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "created", label: "Not finished" },
];

export default async function AdminPayments({ searchParams }: PageProps<"/admin/payments">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const sp = await searchParams;
  const status = str(sp.status);
  const page = pageParam(sp.page);
  const where: Prisma.PaymentWhereInput = ["paid", "failed", "created"].includes(status) ? { status: status as "paid" | "failed" | "created" } : {};
  const prisma = db();
  const { month, today } = istBoundaries();
  const [payments, sumMonth, sumToday, sumAll, open] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE + 1, include: { user: { select: { id: true, email: true } } } }),
    prisma.payment.aggregate({ where: { status: "paid", paidAt: { gte: month } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "paid", paidAt: { gte: today } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "paid" }, _sum: { amount: true }, _count: true }),
    prisma.payment.count({ where: { status: "created", createdAt: { gte: month } } }),
  ]);

  return (
    <>
      <PageTitle title="Payments" text="Razorpay orders for Pro passes. Refunds are made from the Razorpay dashboard." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Today" value={inr(sumToday._sum.amount ?? 0)} note={`${sumToday._count} payments`} />
        <Stat label="This month" value={inr(sumMonth._sum.amount ?? 0)} note={`${sumMonth._count} payments`} />
        <Stat label="All time" value={inr(sumAll._sum.amount ?? 0)} note={`${sumAll._count} payments`} />
        <Stat label="Checkouts not finished this month" value={open} note="opened Razorpay but didn't pay" />
      </div>
      <Filters base="/admin/payments" param="status" options={STATUSES} current={status} />
      <Table head={["Created", "User", "Amount", "Pass", "Status", "Paid", "Razorpay IDs", "Note"]} empty="No payments.">
        {payments.slice(0, PER_PAGE).map((p) => (
          <tr key={p.id}>
            <td className="whitespace-nowrap text-muted-foreground">{dateTime(p.createdAt)}</td>
            <td>{p.user ? <Link href={`/admin/users/${p.user.id}`} className="hover:underline">{p.user.email}</Link> : <span className="text-muted-foreground">deleted user</span>}</td>
            <td className="whitespace-nowrap">{inr(p.amount)}</td>
            <td className="whitespace-nowrap">
              {p.plan}, {p.days} d
            </td>
            <td>
              <Badge variant={p.status === "paid" ? "default" : p.status === "failed" ? "destructive" : "outline"}>{p.status === "created" ? "not paid" : p.status}</Badge>
            </td>
            <td className="whitespace-nowrap text-muted-foreground">{p.paidAt ? dateTime(p.paidAt) : "—"}</td>
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
      <Pager base="/admin/payments" page={page} hasNext={payments.length > PER_PAGE} keep={status ? { status } : undefined} />
    </>
  );
}
