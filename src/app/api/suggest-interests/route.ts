import Anthropic from "@anthropic-ai/sdk";
import { INTEREST_OPTIONS } from "@/lib/options";

export const runtime = "nodejs";

type Body = { imageDataUrl?: string; selected?: string[] };
type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Split a data URL into its media type + raw base64 (Claude wants base64 only).
function parseDataUrl(
  dataUrl: string
): { mediaType: ImageMediaType; base64: string } | null {
  const m = /^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/.exec(dataUrl);
  return m ? { mediaType: m[1] as ImageMediaType, base64: m[2] } : null;
}

// Used when ANTHROPIC_API_KEY isn't set (or the call fails) so the flow always
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

  // No key (or unreadable image) → mock, so the demo never breaks.
  if (!process.env.ANTHROPIC_API_KEY || !parsed) {
    return Response.json({ interests: mockSuggest(selected) });
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-8",
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
                "A youth mentor is adding this photo to their profile to show what they're into. " +
                "From the provided list, pick the interests this photo genuinely shows the person doing or clearly represents. " +
                "Only choose what's actually depicted — 0 to 3 tags. Call the suggest_interests tool.",
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
    return Response.json({ interests: interests.slice(0, 3) });
  } catch {
    // Network / model / auth error — degrade to the mock rather than 500.
    return Response.json({ interests: mockSuggest(selected) });
  }
}
