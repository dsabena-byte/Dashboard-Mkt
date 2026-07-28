import { redirect } from "next/navigation";

// "Generador de Contenido" entra al calendario, que tiene los dos tabs:
// Generación de Contenidos RRSS y Generación de Contenidos UGC.
export default function ContenidoPage() {
  redirect("/contenido/calendario");
}
