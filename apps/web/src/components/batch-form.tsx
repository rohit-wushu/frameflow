"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { createBatch, previewBatch, type BatchPreview, type BatchResult } from "@/app/actions/batch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BatchForm({ sources }: { sources: { id: string; title: string; format: string }[] }) {
  const router = useRouter();
  const [source, setSource] = useState(sources[0]?.id ?? "");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [pending, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);

  // re-check whenever the source or the CSV changes (debounced)
  useEffect(() => {
    if (!source) return;
    const t = setTimeout(() => void previewBatch(source, csv).then(setPreview), 300);
    return () => clearTimeout(t);
  }, [source, csv]);

  if (!sources.length) return <p className="text-muted-foreground">Make a video first; its storyboard becomes the batch template.</p>;
  const placeholders = preview?.placeholders ?? [];
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Template video</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title} ({s.format})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {placeholders.length ? (
              <>Placeholders in its storyboard: {placeholders.map((p) => `{{${p}}}`).join(", ")}</>
            ) : (
              <>This storyboard has no placeholders yet. Open it and write e.g. {"{{name}}"} where each video should differ.</>
            )}
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="csv">CSV (first row: column names)</Label>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setCsv(await f.text());
              }}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => file.current?.click()}>
              Upload .csv
            </Button>
          </div>
          <Textarea id="csv" value={csv} onChange={(e) => setCsv(e.target.value)} rows={8} className="font-mono text-xs" placeholder={placeholders.length ? `${placeholders.join(",")}\n${placeholders.map(() => "…").join(",")}` : "name,city\nAsha,Pune"} />
        </div>
        {preview && !preview.ok && preview.error && (
          <Alert variant="destructive">
            <AlertDescription>{preview.error}</AlertDescription>
          </Alert>
        )}
        {result && !result.ok && (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <div>{result.error}</div>
              {result.rowErrors?.slice(0, 8).map((r) => (
                <div key={r.row} className="text-xs">
                  Row {r.row}: {r.problems.slice(0, 3).join("; ")}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        <Button
          size="lg"
          disabled={pending || !preview?.ok}
          onClick={() =>
            start(async () => {
              const r = await createBatch(source, csv);
              setResult(r);
              if (r.ok) {
                toast.success(`${r.videos} videos queued`);
                setCsv("");
                router.refresh();
              }
            })
          }
        >
          {pending ? "Checking every row…" : preview?.ok ? `Make ${preview.rows} videos` : "Make videos"}
        </Button>
      </div>
      {preview?.ok && (
        <div className="space-y-2">
          <Label>Preview ({preview.rows} rows)</Label>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                      {placeholders.includes(h) ? "" : <span className="ml-1 text-xs font-normal text-muted-foreground">(unused)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((row, i) => (
                  <tr key={i} className="border-t">
                    {preview.headers.map((h) => (
                      <td key={h} className="max-w-48 truncate px-3 py-2">
                        {row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows > preview.sample.length && <p className="text-xs text-muted-foreground">…and {preview.rows - preview.sample.length} more.</p>}
        </div>
      )}
    </div>
  );
}
