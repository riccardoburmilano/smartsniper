import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: "Society",
  description: "La community Bur Society: lounge, studio, appartenenza.",
};

export default function SocietyPage() {
  return (
    <ComingSoon
      eyebrow="Society"
      title="Una casa, non un corso."
      body="Lounge, studio, rituali. La community arriva dopo Academy — pagina in costruzione, stessa disciplina tipografica."
    />
  );
}
