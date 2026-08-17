import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";

export const metadata: Metadata = {
  title: "Shop",
  description: "Merch Bur Society — abbigliamento del culto.",
};

export default function ShopPage() {
  return (
    <ComingSoon
      eyebrow="Shop"
      title="Merch del culto."
      body="Abbigliamento minimale, nero e crema. Catalogo in arrivo — stessa ossessione tipografica."
    />
  );
}
