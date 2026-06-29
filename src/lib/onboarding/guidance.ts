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
    // Swapped from "something that makes you feel like a kid again" (too generic,
    // object-y) → a moment/feeling that's far more personality-telling.
    "something you'd send a friend at 1am",
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
    "the last thing that made you laugh",
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

// Vibe-step social proof. Low-pressure, no overpromising (somethings-copywriting).
// The step's framing ("a few is plenty") lives in the vibe-step subtitle; this is
// just the light, honest nudge shown below the board.
// DIRECTIONAL ONLY — data-backed pending a real number. We know fuller vibe
// profiles tend to match better, but have no citable figure yet. Do NOT add a
// statistic ("3x", "most mentors") without one. TODO(data-backed): upgrade to a
// quantified line once the completion→match figure exists.
export const VIBE_CONTEXT = {
  social: "Mentors who add a few of these tend to connect more easily.",
};

// Exemplar bios shown one at a time on the bio step (cycle with "Show another").
// These model what a STRONG bio looks like — specific, a little personality, easy
// to picture the person — not a minimum fill. Each carries a one-line "why it
// works" tag so the card teaches criteria, not a single answer to paste verbatim.
// Voice: warm, human, non-clinical, no overpromising (somethings-copywriting).
export const BIO_EXAMPLES: { text: string; why: string }[] = [
  {
    text: "I'm a UX designer and weekend muralist. I got into mentoring because someone once told me my 'too many interests' were a strength, not a problem — happy to talk creative stuff, burnout, or figuring out what's next.",
    why: "Names real interests and what they're up for talking about.",
  },
  {
    text: "Nursing student by day, very amateur rock climber on weekends. I'm the first in my family to go to college and I had no clue what I was doing — I'd love to be the person I needed back then.",
    why: "Gives a real reason to mentor, with a detail that sticks.",
  },
  {
    text: "I teach middle-school science and I'm a little too into bad reality TV and good coffee. I mentor because the small, regular check-ins are the ones that stuck with me growing up. No lectures, promise.",
    why: "Has personality and sets a clear, low-pressure tone.",
  },
  {
    text: "I work in music production and I'm a big believer that everyone's got a thing they light up about. I became a mentor to be a steady, no-pressure person to talk to — about the big stuff or nothing in particular.",
    why: "Sounds warm and genuinely easy to talk to.",
  },
];
