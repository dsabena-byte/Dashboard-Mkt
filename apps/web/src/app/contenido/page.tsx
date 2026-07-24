import { redirect } from "next/navigation";

// "Generador de Contenido" ahora entra directo al calendario (el flujo principal).
// El generador de piezas sueltas vive en /contenido/generar.
export default function ContenidoPage() {
  redirect("/contenido/calendario");
}
