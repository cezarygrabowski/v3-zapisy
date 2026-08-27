export const REGULAMIN_TITLE = "Regulamin przelotów i udziału w wojnach"

export const ARTICLES = [
  {
    id: "1",
    title: "Priorytet",
    paragraphs: [
      "Osoby, które podczas bicia się musiały wylogować swoją postać w celu zalogowania postaci PvP, mają pierwszeństwo do dokończenia swojego czasu.",
    ],
  },
  {
    id: "2",
    title: "Udział w wojnach",
    bullets: [
      "Osoby posiadające wyłącznie postacie PvM i niemogące uczestniczyć w bitkach są zobowiązane do wpłaty dodatkowych 4 kk do wspólnej puli.",
      "Każdy gracz powinien jasno określić, czy bierze udział w działaniach PvP, czy wyłącznie PvM.",
    ],
  },
  {
    id: "3",
    title: "Godziny, które obstawiamy",
    paragraphs: [
      "Główne obstawianie odbywa się w godzinach 8:30 – 20:30.",
    ],
  },
  {
    id: "4",
    title: "Rozkazy dla PvP",
    paragraphs: [
      "Bezsensowne wypierdalanie się PvPkiem tylko na własną rękę. Wchodzenie w walki 1 vs 3 jest bezsensowne, a gildia nie będzie sponsorować takich bitek.",
    ],
  },
  {
    id: "5",
    title: "Definicja postaci PvP",
    paragraphs: ["Za postać PvP uznawana jest postać posiadająca:"],
    bullets: [
      "minimum dwie umiejętności bojowe na poziomie P",
      "odpowiedni ekwipunek wojenny (nie padniesz na skilla)",
    ],
  },
  {
    id: "6",
    title: "Benefity PvP",
    paragraphs: [
      "Do jednej postaci PvP można przypisać maksymalnie dwie postacie PvM.",
    ],
  },
] as const

export const FEES = [
  { kind: "PvM", amount: "7 kk" },
  { kind: "PvP / PvM", amount: "3 kk" },
] as const

export const FUNDS_USE =
  "Odpał dla postaci PvP (odpał ryby, ataki, przepustki, rosy, wody itd.)."

export const CLOSING = [
  "Regulamin obowiązuje wszystkich uczestników przelotów.",
  "Nieznajomość regulaminu nie zwalnia z jego przestrzegania.",
  "Celem regulaminu jest sprawna organizacja, uczciwy podział obowiązków oraz zapewnienie płynnego przebiegu V3.",
] as const
