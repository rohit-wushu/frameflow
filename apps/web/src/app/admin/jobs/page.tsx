import { db, type Prisma } from "@frameflow/db";
import Link from "next/link";
import { ago, Filters, PageTitle, Pager, pageParam, str, Table } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Jobs" };

const PER_PAGE = 50;
const STATUSES = [
  { value: "", label: "All" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "done", label: "Done" },
];
const KINDS = [
  { value: "", label: "All kinds" },
  { value: "render", label: "Renders" },
  { value: "direct", label: "Scripts" },
  { value: "chat", label: "Chat edits" },
  { value: "research", label: "Website research" },
];

// Every background job (website research, script writing, chat edits, renders), as mirrored from the queue.
export default async function AdminJobs({ searchParams }: PageProps<"/admin/jobs">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const sp = await searchParams;
  const status = STATUSES.some((s) => s.value === str(sp.status)) ? str(sp.status) : "";
  const kind = KINDS.some((k) => k.value === str(sp.kind)) ? str(sp.kind) : "";
  const page = pageParam(sp.page);
  const where: Prisma.JobWhereInput = {
    ...(status ? { status: status as Prisma.EnumJobStatusFilter["equals"] } : {}),
    ...(kind ? { kind: kind as Prisma.EnumJobKindFilter["equals"] } : {}),
  };
  const jobs = await db().job.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE + 1,
    include: { user: { select: { id: true, email: true } }, project: { select: { title: true } } },
  });

  return (
    <>
      <PageTitle title="Jobs" text="Background work: website research, script writing, chat edits and renders." />
      <div className="flex flex-wrap gap-4">
        <Filters base="/admin/jobs" param="status" options={STATUSES} current={status} keep={kind ? { kind } : undefined} />
        <Filters base="/admin/jobs" param="kind" options={KINDS} current={kind} keep={status ? { status } : undefined} />
      </div>
      <Table head={["Started", "Kind", "Video", "User", "Status", "Step", "Took", "Error"]} empty="No jobs match.">
        {jobs.slice(0, PER_PAGE).map((j) => (
          <tr key={j.id}>
            <td className="whitespace-nowrap text-muted-foreground">{ago(j.createdAt)}</td>
            <td>
              {j.kind}
              {j.version ? <span className="text-muted-foreground"> v{j.version}</span> : null}
            </td>
            <td className="max-w-56 truncate">
              <Link href={`/admin/projects/${j.projectId}`} className="hover:underline">
                {j.project.title}
              </Link>
            </td>
            <td className="text-muted-foreground">
              <Link href={`/admin/users/${j.user.id}`} className="hover:underline">
                {j.user.email}
              </Link>
            </td>
            <td>
              <Badge variant={j.status === "failed" ? "destructive" : j.status === "done" ? "secondary" : "outline"}>{j.status}</Badge>
            </td>
            <td className="whitespace-nowrap text-muted-foreground">
              {j.step ?? "—"} ({j.stepsDone}/{j.stepsTotal})
            </td>
            <td className="whitespace-nowrap text-muted-foreground">{Math.round((j.updatedAt.getTime() - j.createdAt.getTime()) / 1000)}s</td>
            <td className="max-w-sm truncate text-xs text-destructive" title={j.error ?? ""}>
              {j.error ?? ""}
            </td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/jobs" page={page} hasNext={jobs.length > PER_PAGE} keep={{ ...(status ? { status } : {}), ...(kind ? { kind } : {}) }} />
    </>
  );
}
