export type Course = {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  statement: string;
  focus: string[];
  duration: string;
};

export const courses: Course[] = [
  {
    id: "doppiaggio",
    index: "01",
    title: "Doppiaggio",
    subtitle: "Voce. Presenza. Controllo.",
    statement:
      "La voce come strumento di identità. Tecnica, interpretazione e disciplina del personaggio — in studio, non in aula.",
    focus: ["Interpretazione", "Mic technique", "Character work", "Session craft"],
    duration: "12 settimane",
  },
  {
    id: "dj-prod",
    index: "02",
    title: "DJ & Prod",
    subtitle: "Ritmo. Texture. Firma.",
    statement:
      "Produzione e performance come un unico gesto. Dal set alla traccia: suono grezzo, gusto preciso, firma personale.",
    focus: ["Sound design", "Arrangement", "Live set", "A&R mindset"],
    duration: "14 settimane",
  },
];
