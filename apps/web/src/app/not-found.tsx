import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">This page doesn&apos;t exist, or it isn&apos;t yours.</p>
      <Button asChild variant="secondary">
        <Link href="/">Back to your videos</Link>
      </Button>
    </main>
  );
}
