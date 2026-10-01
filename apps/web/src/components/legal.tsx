import { site } from "@/lib/site";

// Layout for the legal pages: a title, the last-updated date, then sections of plain prose.
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="space-y-8 text-[0.95rem] leading-relaxed text-foreground/85 [&_a]:text-foreground [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_p]:my-3 [&_ul]:my-3 [&_ul]:space-y-1.5">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">Last updated: {site.updated}</p>
      </header>
      <div>{children}</div>
    </article>
  );
}

// "Frameflow is run by <legal name>, <address>." (address only when set)
export function Operator() {
  return (
    <>
      {site.name} is operated by {site.legalName}
      {site.address ? `, ${site.address}` : ""}
    </>
  );
}

export function ContactLink() {
  return <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>;
}
