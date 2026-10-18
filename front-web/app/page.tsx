import type { Metadata } from "next";
import AgroCenterApp from "./AgroCenterApp";

export const metadata: Metadata = {
  title: { absolute: "AgroCenter Digital" },
  description: "Insumos, herramientas y soluciones para el campo, con despacho a todo Chile.",
};

export default function Home() {
  return <AgroCenterApp />;
}
