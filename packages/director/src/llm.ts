import Anthropic from "@anthropic-ai/sdk";

export interface LlmRequest {
  system: string;
  user: string;
}

export interface LlmResponse {
  text: string;
  model: string; // the model that produced the answer (differs from the requested one after a fallback)
  fallback: boolean;
  usage: { input: number; output: number; cacheRead: number };
}

export type Llm = (req: LlmRequest) => Promise<LlmResponse>;

export class DirectorError extends Error {}

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// Claude via the Anthropic SDK. The key comes from ANTHROPIC_API_KEY (.env); it is never logged.
export function anthropicLlm(opts: { model: string; effort: Effort; maxTokens?: number }): Llm {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new DirectorError("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.");
  }
  const client = new Anthropic();
  const maxTokens = opts.maxTokens ?? 32000;

  return async ({ system, user }) => {
    const base = {
      model: opts.model,
      max_tokens: maxTokens,
      system: [{ type: "text" as const, text: system, cache_control: { type: "ephemeral" as const } }],
      messages: [{ role: "user" as const, content: user }],
      output_config: { effort: opts.effort },
    };
    let message;
    try {
      // On a safety decline, the API re-runs the request on a fallback model instead of refusing.
      message = FALLBACK_MODELS.has(opts.model)
        ? await client.beta.messages.stream({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }).finalMessage()
        : await client.beta.messages.stream(base).finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new DirectorError("the Anthropic API key was rejected; check ANTHROPIC_API_KEY in .env");
      if (e instanceof Anthropic.NotFoundError) throw new DirectorError(`model "${opts.model}" was not found; check DIRECTOR_MODEL in .env`);
      if (e instanceof Anthropic.RateLimitError) throw new DirectorError("the Anthropic API rate limit was hit; try again in a minute");
      if (e instanceof Anthropic.APIError) throw new DirectorError(`Anthropic API error ${e.status}: ${e.message}`);
      throw e;
    }
    if (message.stop_reason === "refusal") {
      throw new DirectorError(`the model declined to write this video (${message.stop_details?.category ?? "no category"}); try rewording the brief`);
    }
    if (message.stop_reason === "max_tokens") throw new DirectorError("the plan was cut off (max_tokens); try a shorter video");
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const fallback = (message.usage.iterations ?? []).some((it) => it.type === "fallback_message");
    return {
      text,
      model: message.model,
      fallback,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 },
    };
  };
}
