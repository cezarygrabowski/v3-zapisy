/** Class + specialization (guild slang) → its skills, as listed on https://wiki.eldermt2.pl/klasy/ */
export const CLASS_SKILLS: Record<string, string[]> = {
  "Wojownik — Mental": ["Silne Ciało", "Tąpnięcie", "Duchowe Uderzenie", "Uderzenie Miecza", "Walnięcie"],
  "Wojownik — Body": ["Aura Miecza", "Berserk", "Szarża", "Wir Miecza", "Trzystronne Cięcie"],
  "Szaman — Smok": [
    "Latający Talizman",
    "Smoczy Skowyt",
    "Strzelający Smok",
    "Błogosławieństwo",
    "Pomoc Smoka",
    "Odbicie",
  ],
  "Szaman — Healer": [
    "Rzut Piorunem",
    "Przywołanie Błyskawicy",
    "Burzowy Szpon",
    "Leczenie",
    "Zwinność",
    "Zwiększenie Ataku",
  ],
  "Ninja — Dagger": ["Krycie Się", "Zasadzka", "Szybki Atak", "Wirujący Sztylet", "Trująca Chmura"],
  "Ninja — Archer": ["Bezszelestny Chód", "Deszcz Strzał", "Ognisty Strzał", "Powtarzalny Strzał", "Trujący Strzał"],
  "Sura — WP": [
    "Czarowane Ostrze",
    "Czarowana Zbroja",
    "Strach",
    "Rozproszenie Magii",
    "Smoczy Wir",
    "Uderzenie Palcem",
  ],
  "Sura — BM": [
    "Mroczna Ochrona",
    "Ognisty Duch",
    "Duchowy Cios",
    "Mroczne Uderzenie",
    "Mroczna Sfera",
    "Ogniste Uderzenie",
  ],
}

const ABS_TYPES = ["Miecze", "Dwuręka", "Sztylety", "Strzały", "Wachlarze", "Dzwony", "Magia"]

/** EQ groups shown on the report; each section has its own fields and its own screenshots (image kind). */
export const EQ_GROUPS = [
  {
    title: "EQ wojenne",
    note: "EQ takie jak na wojnę, bez odpałów 🙂",
    sections: [
      {
        kind: "absy",
        title: "1) ABSY",
        fields: ABS_TYPES.map((label) => ({ name: `ABS ${label}`, label, unit: "%" })),
      },
      {
        kind: "silny",
        title: "2) Silny przeciwko ludziom",
        fields: [{ name: "Silny przeciwko ludziom", label: "Silny przeciwko ludziom", unit: "%" }],
      },
      { kind: "hp", title: "3) HP w eq wojennym", fields: [{ name: "HP", label: "HP", unit: "" }] },
    ],
  },
  {
    title: "EQ PVM",
    note: "",
    sections: [
      {
        kind: "dunga",
        title: "EQ pod dunga",
        hint: "Priorytetowo % na mistyki, później zwierzęta, HP na drugim planie.",
        fields: [
          { name: "Dunga Mistyki", label: "Na mistyki", unit: "%" },
          { name: "Dunga Zwierzęta", label: "Na zwierzęta", unit: "%" },
          { name: "Dunga HP", label: "HP", unit: "" },
          {
            name: "Dunga Fala mocy",
            label: "Fala mocy",
            unit: "",
            options: [...Array.from({ length: 19 }, (_, i) => String(i + 1)), "M1"],
          },
        ],
      },
      {
        kind: "wb",
        title: "EQ na diabły",
        hint: "Priorytetowo % na diabły, absy na drugim planie.",
        fields: [
          { name: "WB/Metin Diabły", label: "Na diabły", unit: "%" },
          { name: "WB/Metin HP", label: "HP", unit: "" },
          ...ABS_TYPES.map((label) => ({ name: `WB/Metin ABS ${label}`, label: `ABS ${label}`, unit: "%" })),
        ],
      },
    ],
  },
]

export const EQ_SECTIONS = EQ_GROUPS.flatMap((g) => g.sections)

export const IMAGE_KINDS = [...EQ_SECTIONS.map((s) => s.kind), "inne"]

// shortcut: standard Metin2 scale (0 = not learned, 1–17, then M/G/P); extend if ElderMT2 adds levels.
export const SKILL_LEVELS = [
  ...Array.from({ length: 18 }, (_, i) => String(i)),
  ...Array.from({ length: 10 }, (_, i) => `M${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `G${i + 1}`),
  "P",
]

/** Splits "Name: value" lines; a line without a colon is a name with an empty value. */
export function parseEntries(text: string): { name: string; value: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":")
      return i < 0 ? { name: line, value: "" } : { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }
    })
}

/** Lines for the given names in order, keeping values already set for the same names. */
export function orderedLines(names: string[], text: string, changed?: { name: string; value: string }) {
  const values = new Map(parseEntries(text).map((e) => [e.name.toLowerCase(), e.value]))
  if (changed) values.set(changed.name.toLowerCase(), changed.value)
  return names.map((name) => `${name}: ${values.get(name.toLowerCase()) ?? ""}`).join("\n")
}

export const skillLines = (characterClass: string, skills: string, changed?: { name: string; value: string }) =>
  orderedLines(CLASS_SKILLS[characterClass] ?? [], skills, changed)

export const eqLines = (equipment: string, changed?: { name: string; value: string }) =>
  orderedLines(
    EQ_SECTIONS.flatMap((s) => s.fields.map((f) => f.name)),
    equipment,
    changed,
  )
