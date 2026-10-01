import type { Asset } from "@frameflow/scene-schema";
import type { z } from "zod";

export interface TemplateMeta {
  name: string;
  description: string;
  whenToUse: string;
  category: "hook" | "content" | "end";
  minDuration: number; // seconds
  maxDuration: number;
  listField?: string; // content field whose items appear one by one (each gets a reveal time + a pop)
  accentAt?: number; // seconds after the scene start where the template's big hit lands
  accentSound?: string; // default SFX on the accent
}

export interface TemplateExample {
  content: Record<string, unknown>;
  voiceover: string;
  estDuration: number;
  assets?: Record<string, Asset>; // images the example uses (files relative to the template folder)
}

export interface Template {
  meta: TemplateMeta;
  schema: z.ZodType;
  html: string; // the template.html fragment: a <style> and a <script> that calls FF.register(name, build)
  example: TemplateExample;
  dir: string;
}
