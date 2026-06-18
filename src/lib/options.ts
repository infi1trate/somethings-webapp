// Option sets for the profile builder. Kept here so they're easy to tune to the
// real Somethings taxonomy later. Labels are mentor-facing.

export const SEX_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export const GENDER_IDENTITY_OPTIONS = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "transgender", label: "Transgender" },
  { value: "genderqueer", label: "Genderqueer / Gender fluid" },
  { value: "agender", label: "Agender" },
  { value: "self_describe", label: "Prefer to self-describe" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export const PRONOUN_OPTIONS = [
  "she/her",
  "he/him",
  "they/them",
  "she/they",
  "he/they",
  "ze/zir",
];

export const RACE_OPTIONS = [
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Middle Eastern or North African",
  "Native American or Alaska Native",
  "Native Hawaiian or Pacific Islander",
  "White",
  "Multiracial",
  "Prefer not to say",
];

export const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "Mandarin",
  "French",
  "Arabic",
  "Tagalog",
  "Vietnamese",
  "Korean",
  "Portuguese",
  "ASL",
];

// Life experiences a mentor can speak to — these help match teens to mentors
// who've been through something similar. Phrased plainly, not clinically.
export const LIFE_EXPERIENCE_OPTIONS = [
  "Anxiety",
  "Low mood",
  "School stress",
  "Family changes",
  "Friendship & social stuff",
  "Identity & belonging",
  "LGBTQ+ experience",
  "Moving / starting over",
  "Loss & grief",
  "Body image",
  "Neurodivergence (ADHD, autism)",
  "First-gen / college path",
];

export const INTEREST_OPTIONS = [
  "Music",
  "Gaming",
  "Art & drawing",
  "Sports",
  "Reading",
  "Movies & TV",
  "Cooking",
  "Photography",
  "Fashion",
  "Working out",
  "Anime",
  "Hiking & outdoors",
  "Coding",
  "Dance",
  "Skateboarding",
  "Volunteering",
];
