export const site = {
  name: "Bur Society",
  tagline: "The Milanese Creative Cult",
  location: "Milano",
  description:
    "Accademia creativa e community esclusiva. Doppiaggio, DJ & Produzione — un culto milanese per chi crea.",
} as const;

export const nav = [
  { href: "/academy", label: "Academy" },
  { href: "/society", label: "Society" },
  { href: "/admission", label: "Admission" },
  { href: "/shop", label: "Shop" },
] as const;
