import {
  Music,
  Gamepad2,
  Palette,
  Trophy,
  BookOpen,
  Clapperboard,
  ChefHat,
  Camera,
  Shirt,
  Dumbbell,
  Mountain,
  Code,
  Sparkles,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

// Maps each interest (from INTEREST_OPTIONS) to a Lucide icon. Shared by the
// hero interest chips, the photo-gallery tags, and the teen-preview photo tags.
export const INTEREST_ICONS: Record<string, LucideIcon> = {
  Music,
  Gaming: Gamepad2,
  "Art & drawing": Palette,
  Sports: Trophy,
  Reading: BookOpen,
  "Movies & TV": Clapperboard,
  Cooking: ChefHat,
  Photography: Camera,
  Fashion: Shirt,
  "Working out": Dumbbell,
  Anime: Sparkles,
  "Hiking & outdoors": Mountain,
  Coding: Code,
  Dance: Music,
  Skateboarding: Trophy,
  Volunteering: HeartHandshake,
};

export const iconFor = (i: string): LucideIcon => INTEREST_ICONS[i] ?? Sparkles;
