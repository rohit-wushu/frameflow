"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalog, type JsonSchema } from "@/lib/catalog";
import { cn } from "@/lib/utils";

// A form for one template's `content`, generated from its JSON schema (strings, numbers, choices, lists).
// "image" picks one of the plan's images; "focus" one of that image's zoom regions.
type Obj = Record<string, unknown>;
export type Assets = Record<string, { description?: string; regions?: Record<string, unknown> }>;

function Choice({ id, value, options, onChange, placeholder }: { id: string; value: string | undefined; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue placeholder={placeholder ?? "Choose"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const human = (name: string) => name.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const isType = (s: JsonSchema, t: string) => s.type === t || (Array.isArray(s.type) && s.type.includes(t));

function StringField({ id, name, schema, value, onChange, error }: { id: string; name: string; schema: JsonSchema; value: unknown; onChange: (v: string | undefined) => void; error?: string }) {
  const text = typeof value === "string" ? value : "";
  const max = schema.maxLength;
  const long = (max ?? 0) > 70;
  const common = {
    id,
    value: text,
    maxLength: max,
    placeholder: schema.description,
    "aria-invalid": !!error,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value === "" ? undefined : e.target.value),
  };
  const icon = name === "icon";
  return (
    <>
      {long ? <Textarea {...common} rows={2} className="resize-none" /> : <Input {...common} list={icon ? "ff-icons" : undefined} className={cn(icon && "font-mono")} />}
      {max && text.length > max * 0.75 && <span className={cn("text-[11px] text-muted-foreground", text.length > max * 0.9 && "text-amber-400")}>{text.length}/{max}</span>}
    </>
  );
}

function FieldRow({ label, error, htmlFor, children }: { label: string; error?: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ContentFields({ idPrefix, schema, value, onChange, errors, row = false, assets = {} }: { idPrefix: string; schema: JsonSchema; value: Obj; onChange: (v: Obj) => void; errors: Record<string, string>; row?: boolean; assets?: Assets }) {
  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className={cn("grid gap-4", row && "gap-3 sm:grid-cols-[9rem_1fr_1.4fr]")}>
      {Object.entries(schema.properties ?? {}).map(([key, s]) => {
        const id = `${idPrefix}-${key}`;
        const optional = !(schema.required ?? []).includes(key);
        const label = human(key) + (optional ? " (optional)" : "");
        const error = errors[key];
        if (isType(s, "array") && s.items && isType(s.items, "string")) {
          const list = Array.isArray(value[key]) ? (value[key] as string[]) : [];
          return (
            <FieldRow key={key} label={`${label} (${s.minItems ?? 0}-${s.maxItems ?? "∞"})`} error={error}>
              <div className="space-y-2">
                {list.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={item} maxLength={s.items!.maxLength} aria-invalid={!!errors[`${key}[${i}]`]} onChange={(e) => set(key, list.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground" disabled={list.length <= (s.minItems ?? 0)} onClick={() => set(key, list.filter((_, j) => j !== i))} aria-label="Remove">
                      ×
                    </Button>
                  </div>
                ))}
                {list.length < (s.maxItems ?? Infinity) && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => set(key, [...list, "New point"])}>
                    Add
                  </Button>
                )}
              </div>
            </FieldRow>
          );
        }
        if (isType(s, "array") && s.items?.properties) {
          const list = Array.isArray(value[key]) ? (value[key] as Obj[]) : [];
          const blank = Object.fromEntries(Object.entries(s.items.properties).filter(([k]) => (s.items!.required ?? []).includes(k)).map(([k, p]) => [k, isType(p, "number") ? 0 : k === "icon" ? "sparkles" : "New"]));
          return (
            <FieldRow key={key} label={`${label} (${s.minItems ?? 0}-${s.maxItems ?? "∞"})`} error={error}>
              <div className="space-y-3">
                {list.map((item, i) => (
                  <div key={i} className="relative rounded-lg border bg-muted/30 p-3 pr-10">
                    <ContentFields
                      row
                      idPrefix={`${id}-${i}`}
                      schema={s.items!}
                      value={item}
                      onChange={(v) => set(key, list.map((x, j) => (j === i ? v : x)))}
                      errors={Object.fromEntries(Object.entries(errors).filter(([p]) => p.startsWith(`${key}[${i}].`)).map(([p, m]) => [p.slice(`${key}[${i}].`.length), m]))}
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute top-1.5 right-1.5 size-7 text-muted-foreground" disabled={list.length <= (s.minItems ?? 0)} onClick={() => set(key, list.filter((_, j) => j !== i))} aria-label="Remove">
                      ×
                    </Button>
                  </div>
                ))}
                {list.length < (s.maxItems ?? Infinity) && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => set(key, [...list, blank])}>
                    Add
                  </Button>
                )}
              </div>
            </FieldRow>
          );
        }
        if (key === "image" && isType(s, "string")) {
          const names = Object.keys(assets);
          return (
            <FieldRow key={key} label={label} error={error ?? (names.length ? undefined : "This video has no images (add a website on a new video to get its screenshots).")} htmlFor={id}>
              <Choice id={id} value={value[key] as string | undefined} options={names.map((n) => ({ value: n, label: assets[n].description ? `${n}: ${assets[n].description}` : n }))} onChange={(v) => set(key, v)} placeholder="Pick an image" />
            </FieldRow>
          );
        }
        if (key === "focus" && isType(s, "string")) {
          const regions = Object.keys(assets[String(value.image)]?.regions ?? {});
          return (
            <FieldRow key={key} label={label} error={error} htmlFor={id}>
              <Choice id={id} value={(value[key] as string | undefined) ?? "center"} options={["center", "top", ...regions].map((r) => ({ value: r, label: r }))} onChange={(v) => set(key, v)} />
            </FieldRow>
          );
        }
        if (s.enum) {
          return (
            <FieldRow key={key} label={label} error={error} htmlFor={id}>
              <Choice id={id} value={(value[key] as string | undefined) ?? (s.default as string | undefined)} options={s.enum.map((o) => ({ value: String(o), label: String(o) }))} onChange={(v) => set(key, v)} />
            </FieldRow>
          );
        }
        if (isType(s, "number") || isType(s, "integer")) {
          const n = value[key];
          return (
            <FieldRow key={key} label={label} error={error} htmlFor={id}>
              <Input
                id={id}
                type="number"
                min={s.minimum}
                max={s.maximum}
                step={isType(s, "integer") ? 1 : "any"}
                value={typeof n === "number" ? n : ""}
                aria-invalid={!!error}
                onChange={(e) => set(key, e.target.value === "" ? undefined : Number(e.target.value))}
                className="w-48"
              />
            </FieldRow>
          );
        }
        return (
          <FieldRow key={key} label={label} error={error} htmlFor={id}>
            <StringField id={id} name={key} schema={s} value={value[key]} onChange={(v) => set(key, v)} error={error} />
          </FieldRow>
        );
      })}
    </div>
  );
}

// Icon name suggestions for every icon input on the page.
export function IconList() {
  return (
    <datalist id="ff-icons">
      {catalog.icons.map((i) => (
        <option key={i} value={i} />
      ))}
    </datalist>
  );
}
