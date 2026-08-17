import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: "Admission",
  description: "Candidatura Bur Society — selezione, non iscrizione.",
};

export default function AdmissionPage() {
  return (
    <ComingSoon
      eyebrow="Admission"
      title="Perché tu."
      body="Il form di candidatura arriverà qui: minimale, diretto, da club privato. Racconta perché vuoi entrare."
    />
  );
}
