import { Badge } from "@/components/ui/badge";

const LABELS: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  researching: { text: "Reading website", variant: "secondary" },
  brand: { text: "Check brand", variant: "outline" },
  directing: { text: "Writing script", variant: "secondary" },
  storyboard: { text: "Storyboard", variant: "outline" },
  rendering: { text: "Rendering", variant: "secondary" },
  ready: { text: "Ready", variant: "default" },
  failed: { text: "Failed", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = LABELS[status] ?? { text: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.text}</Badge>;
}
