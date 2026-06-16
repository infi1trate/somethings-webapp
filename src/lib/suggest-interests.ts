// Client helper: ask the server route to suggest interest tags for a photo.
// The route uses Claude vision when ANTHROPIC_API_KEY is set, and otherwise
// returns a mock — so this never throws on the happy path. Returns [] on any
// transport failure.
export async function suggestInterests(
  imageDataUrl: string,
  selected: string[]
): Promise<string[]> {
  try {
    const res = await fetch("/api/suggest-interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl, selected }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { interests?: unknown };
    return Array.isArray(data.interests)
      ? data.interests.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
