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

// The vibe step's prompt deck — playful, oddly-specific prompts that surface a
// feeling/aesthetic/personality photo (not an activity photo) from the mentor's
// own camera roll. A ROTATABLE set: swap or reorder freely (seasonal refresh).
// Voice: calm, warm, low-pressure — never hype. Loosely ordered easy → effortful
// so there's always an answerable one.
export const VIBE_PROMPTS = [
  "a screenshot you've never deleted",
  "the most “your room” photo on your phone",
  "something you'd put on a poster",
  "the last thing that made you laugh",
  "your wallpaper, right now",
  "a photo only you would've taken",
];

// Shown once the curated prompts run out — keeps the door open without pressure.
export const VIBE_CATCHALL = "anything else that feels like you";

// Example bios that cycle one at a time on the bio step.
export const BIO_EXAMPLES = [
  "I'm a 22-year-old grad student studying social work, and I've always been passionate about creating spaces where people feel heard. I became a mentor because I remember how isolating high school felt, and I want to be the person I wish I had back then — someone who just gets it.",
  "I'm 24, working in graphic design, and I spend most of my free time at coffee shops sketching or playing guitar. I wanted to become a mentor because I went through a lot of self-doubt as a teen, and I know how much it helps to have someone in your corner who believes in you.",
];
