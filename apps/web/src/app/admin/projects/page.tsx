import { db, type Prisma } from "@frameflow/db";
import { Search } from "lucide-react";
import Link from "next/link";
import { ago, Filters, PageTitle, Pager, pageParam, str, Table } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Videos" };

const PER_PAGE = 50;
const STATUSES = ["", "ready", "rendering", "storyboard", "failed", "directing", "brand", "researching"];
const LABEL: Record<string, string> = { "": "All", ready: "Ready", rendering: "Rendering", storyboard: "Storyboard", failed: "Failed", directing: "Writing script", brand: "Brand check", researching: "Reading website" };

export default async function AdminProjects({ searchParams }: PageProps<"/admin/projects">) {
  await requireAdmin(); // every page checks: the layout alone is skipped on client navigation
  const sp = await searchParams;
  const status = STATUSES.includes(str(sp.status)) ? str(sp.status) : "";
  const q = str(sp.q).trim().slice(0, 100);
  const userId = str(sp.user);
  const page = pageParam(sp.page);
  const where: Prisma.ProjectWhereInput = {
    ...(status ? { status: status as Prisma.EnumProjectStatusFilter["equals"] } : {}),
    ...(userId ? { userId } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { prompt: { contains: q, mode: "insensitive" } }, { url: { contains: q, mode: "insensitive" } }, { id: q }] } : {}),
  };
  const prisma = db();
  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE + 1,
      select: { id: true, title: true, url: true, status: true, format: true, durationSec: true, language: true, currentVersion: true, updatedAt: true, error: true, user: { select: { id: true, email: true } } },
    }),
    prisma.project.count({ where }),
  ]);
  const keep = { ...(q ? { q } : {}), ...(userId ? { user: userId } : {}) };

  return (
    <>
      <PageTitle title="Videos" text={`${total} ${total === 1 ? "video" : "videos"}${userId ? " by this user" : ""}`}>
        <form className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          {status && <input type="hidden" name="status" value={status} />}
          {userId && <input type="hidden" name="user" value={userId} />}
          <Input name="q" defaultValue={q} placeholder="Search title, prompt or website" className="h-9 pl-9" />
        </form>
      </PageTitle>
      <Filters base="/admin/projects" param="status" options={STATUSES.map((s) => ({ value: s, label: LABEL[s] }))} current={status} keep={keep} />
      <Table head={["Video", "User", "Status", "Format", "Versions", "Updated"]} empty="No videos match.">
        {projects.slice(0, PER_PAGE).map((p) => (
          <tr key={p.id}>
            <td className="max-w-80">
              <Link href={`/admin/projects/${p.id}`} className="block truncate font-medium hover:underline">
                {p.title}
              </Link>
              {p.url && <div className="truncate text-xs text-muted-foreground">{p.url}</div>}
              {p.status === "failed" && p.error && <div className="truncate text-xs text-destructive" title={p.error}>{p.error}</div>}
            </td>
            <td className="text-muted-foreground">
              <Link href={`/admin/users/${p.user.id}`} className="hover:underline">
                {p.user.email}
              </Link>
            </td>
            <td>
              <StatusBadge status={p.status} />
            </td>
            <td className="whitespace-nowrap text-muted-foreground">
              {p.format} · {p.durationSec}s · {p.language}
            </td>
            <td>{p.currentVersion ?? "—"}</td>
            <td className="whitespace-nowrap text-muted-foreground">{ago(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
      <Pager base="/admin/projects" page={page} hasNext={projects.length > PER_PAGE} keep={{ ...keep, ...(status ? { status } : {}) }} />
    </>
  );
}
