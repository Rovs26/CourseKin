import {
  Atom,
  BarChart3,
  BookOpen,
  Brain,
  Code2,
  FlaskConical,
  Landmark,
  Languages,
  Microscope,
  Palette,
  Scale,
  Sigma,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export type CourseVisual = {
  Icon: LucideIcon;
  /** Tailwind classes for the icon tile: soft tinted background + colored glyph. */
  tile: string;
};

/** Subject keyword → icon. First match wins, so order from specific to broad. */
const SUBJECT_ICONS: Array<{ match: RegExp; Icon: LucideIcon }> = [
  { match: /(econ|financ|account|business|market|trade)/i, Icon: BarChart3 },
  { match: /(chem)/i, Icon: FlaskConical },
  { match: /(bio|anatomy|botany|zoolog|genetic|life science)/i, Icon: Microscope },
  { match: /(physic|engineer|mechan|electr)/i, Icon: Atom },
  { match: /(comp|program|software|coding|data|algorithm|informatic)/i, Icon: Code2 },
  { match: /(math|calc|algebra|geometr|statistic|trigon)/i, Icon: Sigma },
  { match: /(law|legal|juris)/i, Icon: Scale },
  { match: /(med|nurs|health|pharma|clinic|anatomy)/i, Icon: Stethoscope },
  { match: /(philos|ethic|psych|cognit|logic)/i, Icon: Brain },
  { match: /(histor|civic|politic|govern)/i, Icon: Landmark },
  { match: /(lang|literat|english|writing|linguist|communication)/i, Icon: Languages },
  { match: /(art|design|music|drawing|paint|architec)/i, Icon: Palette },
];

/** Soft pastel tiles. Stable across light/dark — small tinted chips read as
 * intentional accents on the dark shell. */
const TILE_PALETTE = [
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
];

/** Deterministic hash so a given course always gets the same color. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Derive a stable icon + tinted tile for a course from its subject and title. */
export function courseVisual(field: string, title: string): CourseVisual {
  const subject = field ?? "";
  const Icon =
    SUBJECT_ICONS.find((entry) => entry.match.test(subject))?.Icon ?? BookOpen;
  const tile = TILE_PALETTE[hashString(`${subject}|${title}`) % TILE_PALETTE.length];
  return { Icon, tile };
}
