import { db } from "@frameflow/db";
import Link from "next/link";
import { dateTime, PageTitle, Pager, pageParam, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Activity log" };

const PER_PAGE = 100;

// Every change to an account: plan changes, disables, role changes, deletions (by admins) and payments (by the system).
export default async function AdminActivity({ searchParams }: PageProps<"/admin/activity">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const page = pageParam((await searchParams).page);
  const prisma = db();
  const log = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE + 1 });
  const shown = log.slice(0, PER_PAGE);
  const ids = [...new Set(shown.flatMap((l) => [l.actorId, l.targetId]).filter((x): x is string => !!x))];
  const emails = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));
  const who = (id: string | null, fallback: string) =>
    !id ? (
      <span className="text-muted-foreground">{fallback}</span>
    ) : emails.has(id) ? (
      <Link href={`/admin/users/${id}`} className="hover:underline">
        {emails.get(id)}
      </Link>
    ) : (
      <span className="text-muted-foreground">deleted user</span>
    );

  return (
    <>
      <PageTitle title="Activity log" text="Changes made by admins, and payments that switched on Pro." />
      <Table head={["When", "By", "Account", "Action", "Details"]} empty="Nothing logged yet.">
        {shown.map((l) => (
          <tr key={l.id}>
            <td className="whitespace-nowrap text-muted-foreground">{dateTime(l.createdAt)}</td>
            <td>{who(l.actorId, "system")}</td>
            <td>{who(l.targetId, "—")}</td>
            <td className="font-mono text-xs">{l.action}</td>
            <td>{l.detail}</td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/activity" page={page} hasNext={log.length > PER_PAGE} />
    </>
  );
}
