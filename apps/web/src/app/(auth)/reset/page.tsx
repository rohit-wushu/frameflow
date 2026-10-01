import Link from "next/link";
import { ResetForm } from "@/components/password-forms";
import { Button } from "@/components/ui/button";
import { tokenValid } from "@/lib/email-tokens";

export const metadata = { title: "Set a new password" };

export default async function ResetPage({ searchParams }: PageProps<"/reset">) {
  const token = String((await searchParams).token ?? "");
  if (!(await tokenValid(token, "reset")))
    return (
      <div className="space-y-4">
        <h1 className="text-gradient text-3xl font-semibold tracking-[-0.03em]">This link has expired</h1>
        <p className="text-sm text-muted-foreground">Reset links work once, for 1 hour. Ask for a new one.</p>
        <Button asChild className="h-11 w-full rounded-xl">
          <Link href="/forgot">Send a new link</Link>
        </Button>
      </div>
    );
  return <ResetForm token={token} />;
}
