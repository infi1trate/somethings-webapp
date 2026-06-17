// Inline mentor-profile guidance, distilled from the "Create an Amazing Mentor
// Profile" guide. Centralized here (like src/lib/options.ts) so the per-step
// helper copy lives in one place. The example scripts/bios are kept close to
// verbatim so mentors can borrow the phrasing.

export const PHOTO_TIPS = {
  dos: [
    "Natural light and a real smile",
    "Face clear, framed around your shoulders",
  ],
  donts: ["Filters, blur, or busy backgrounds"],
  note: "It's the first thing teens see.",
};

export const GALLERY_TIPS = {
  dos: [
    "You actually doing what you're into — concerts, art, hanging out",
    "Tie them to the interests you picked",
  ],
  donts: ["Plain landscapes, random selfies, or shots you're not in"],
};

// The intro step guides the *approach* (a loose flow of beats to hit in your
// own words) rather than handing over a finished script — so it reads as help,
// not something we wrote for them.
export const INTRO_FRAMEWORK = {
  eyebrow: "No script needed — a loose flow if you want one",
  beats: [
    "Who you are — your name and a quick line about you",
    "A couple of things you're into",
    "Why you became a mentor — the real reason",
    "End with a warm, no-pressure hello",
  ],
  note: "Keep it warm and real. Under a minute is plenty.",
};

// The vibe step's prompt pool. Each empty frame on the board carries one of these
// as its caption; a shuffle control swaps it. Grouped INTERNALLY (groups are never
// shown to the user) and interleaved so any few-at-a-time slice reads as a varied
// mix — that's how 20+ prompts get used without ever surfacing more than a handful
// at once. Rotatable config: edit/extend freely. Voice: light + playful (the one
// playful moment in the flow). A prompt is always a suggestion, never a gate.
const VIBE_PROMPT_GROUPS = [
  // Screenshots & saves
  [
    "a screenshot you've never deleted",
    "a meme that's a little too accurate",
    "the last thing you saved because it was funny",
    "a text that lives in your head rent-free",
    "something you screenshotted to send someone later",
  ],
  // Aesthetic & atmosphere
  [
    "your wallpaper energy",
    "a color that feels like you",
    "the most “your room” photo on your phone",
    "a sky you stopped to take a photo of",
    "light you liked enough to keep",
  ],
  // Comfort & character
  [
    "the photo you'd show a friend first",
    "something that makes you feel like a kid again",
    "a place you feel most like yourself",
    "your comfort rewatch, in one image",
    "a snack situation you stand by",
  ],
  // Funny & specific
  [
    "a photo nobody else would think to take",
    "the most chaotic photo you'll admit to",
    "something you'd put on a poster, no explanation",
    "proof you have a weird sense of humor",
    "a photo that needs context (don't give it)",
  ],
  // Open / easy outs
  [
    "anything that just feels like you",
    "a photo you like for no reason",
    "pick whatever, no overthinking",
  ],
];

// Interleave round-robin across groups → any contiguous slice is a varied mix.
export const VIBE_PROMPTS: string[] = (() => {
  const out: string[] = [];
  const longest = Math.max(...VIBE_PROMPT_GROUPS.map((g) => g.length));
  for (let i = 0; i < longest; i++) {
    for (const group of VIBE_PROMPT_GROUPS) {
      if (group[i]) out.push(group[i]);
    }
  }
  return out;
})();

// Example bios that cycle one at a time on the bio step.
export const BIO_EXAMPLES = [
  "I'm a 22-year-old grad student studying social work, and I've always been passionate about creating spaces where people feel heard. I became a mentor because I remember how isolating high school felt, and I want to be the person I wish I had back then — someone who just gets it.",
  "I'm 24, working in graphic design, and I spend most of my free time at coffee shops sketching or playing guitar. I wanted to become a mentor because I went through a lot of self-doubt as a teen, and I know how much it helps to have someone in your corner who believes in you.",
];
