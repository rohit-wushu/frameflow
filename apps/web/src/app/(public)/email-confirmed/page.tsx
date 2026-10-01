import { CircleCheck, CircleX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Email confirmation" };

export default async function EmailConfirmed({ searchParams }: PageProps<"/email-confirmed">) {
  const ok = (await searchParams).ok === "1";
  return (
    <div className="flex flex-col items-center py-16 text-center">
      {ok ? <CircleCheck className="size-12 text-emerald-400" /> : <CircleX className="size-12 text-destructive" />}
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{ok ? "Email confirmed" : "This link didn't work"}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {ok
          ? "Thanks! You can make videos now."
          : "It may have expired or been used already. Log in and use “Resend email” at the top of the page to get a new link."}
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/">{ok ? "Start making videos" : "Go to Frameflow"}</Link>
      </Button>
    </div>
  );
}
