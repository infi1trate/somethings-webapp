import { existsSync } from "node:fs";
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { INTEREST_OPTIONS } from "@/lib/options";

// Claude runs through Google Vertex AI (no Anthropic API key). Auth is Google
// Application Default Credentials — point GOOGLE_APPLICATION_CREDENTIALS at the
// service-account JSON (see .env.example). The `nodejs` runtime is required:
// file-based ADC can't run on the edge runtime.
export const runtime = "nodejs";

const VERTEX_PROJECT_ID = process.env.ANTHROPIC_VERTEX_PROJECT_ID;
const VERTEX_REGION = process.env.CLOUD_ML_REGION || "global";

type Body = { imageDataUrl?: string; selected?: string[] };
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Split a data URL into its media type + raw base64 (Claude wants base64 only).
function parseDataUrl(
  dataUrl: string
): { mediaType: ImageMediaType; base64: string } | null {
  const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl);
  return m ? { mediaType: m[1] as ImageMediaType, base64: m[2] } : null;
}

// Used when Vertex isn't configured (or the call fails) so the flow always
// works in the prototype: a plausible 1–2 tags, biased toward what the mentor
// already picked.
function mockSuggest(selected: string[]): string[] {
  const pool = selected.length ? selected : INTEREST_OPTIONS;
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 2);
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ interests: [] }, { status: 400 });
  }
  const { imageDataUrl, selected = [] } = body;
  const parsed = imageDataUrl ? parseDataUrl(imageDataUrl) : null;

  // No Vertex project configured (or unreadable image) → mock, so the demo
  // never breaks. A missing/invalid credential is caught below and also
  // degrades to the mock.
  if (!VERTEX_PROJECT_ID || !parsed) {
    if (!VERTEX_PROJECT_ID) {
      console.warn(
        "[suggest-interests] ANTHROPIC_VERTEX_PROJECT_ID not set — returning mock suggestions."
      );
    }
    return Response.json({ interests: mockSuggest(selected), source: "mock" });
  }

  // Vertex auth is file-based ADC. If GOOGLE_APPLICATION_CREDENTIALS points at a
  // path that doesn't exist, short-circuit to the mock with a clear message —
  // otherwise the SDK throws a confusing OAuth error (and an unhandled rejection)
  // on every request.
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credsPath && !existsSync(credsPath)) {
    console.warn(
      `[suggest-interests] Vertex credentials file not found at ${credsPath} — returning mock. ` +
        "Point GOOGLE_APPLICATION_CREDENTIALS at a valid service-account JSON to enable AI."
    );
    return Response.json({ interests: mockSuggest(selected), source: "mock" });
  }

  try {
    const client = new AnthropicVertex({
      projectId: VERTEX_PROJECT_ID,
      region: VERTEX_REGION,
    });
    const message = await client.messages.create({
      // TEMPORARY: Claude Opus 4.8 isn't enabled in this Vertex project yet, so
      // we pin Sonnet 4.5 (verified available in us-east5). On Vertex, Sonnet
      // 4.5 uses the @date-suffixed model ID. Once Opus 4.8 is enabled in the
      // Model Garden, restore "claude-opus-4-8" and set CLOUD_ML_REGION=global.
      model: "claude-sonnet-4-5@20250929",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: parsed.mediaType,
                data: parsed.base64,
              },
            },
            {
              type: "text",
              text:
                `A youth mentor tagged this photo to represent "${
                  selected[0] ?? "an interest"
                }" on their profile. ` +
                "Looking only at what the photo actually shows, pick the interests from the provided list it genuinely depicts the person doing or clearly represents — 0 to 3 tags. " +
                `Be objective: if the photo doesn't actually show "${
                  selected[0] ?? "that"
                }", don't include it. Call the suggest_interests tool.`,
            },
          ],
        },
      ],
      tools: [
        {
          name: "suggest_interests",
          description: "Record the interest tags that best match the photo.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            required: ["interests"],
            properties: {
              interests: {
                type: "array",
                items: { type: "string", enum: INTEREST_OPTIONS },
              },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: "suggest_interests" },
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    const raw = (toolUse?.input as { interests?: unknown } | undefined)?.interests;
    const interests = Array.isArray(raw)
      ? raw.filter(
          (x): x is string =>
            typeof x === "string" && INTEREST_OPTIONS.includes(x)
        )
      : [];
    return Response.json({ interests: interests.slice(0, 3), source: "ai" });
  } catch (err) {
    // Network / model / auth error — log it (so a misconfigured Vertex setup is
    // visible in the server logs) and degrade to the mock rather than 500.
    console.error("[suggest-interests] Vertex call failed, using mock:", err);
    return Response.json({ interests: mockSuggest(selected), source: "mock" });
  }
}
