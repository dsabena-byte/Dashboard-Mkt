// Opciones del generador UGC, derivadas del plan de Marketing de Influencia Drean
// 2026 (playbook UGC). Se comparten entre la UI (selectores) y el server (prompts).

export const UGC_PERFILES = [
  { key: "usuario", label: "Usuario", nota: "Testimonio / prueba social · darkpost" },
  { key: "tecnico", label: "Técnico posventa", nota: "Insight técnico con autoridad · darkpost" },
  { key: "personal", label: "Personal Drean", nota: "Humanización de marca · orgánico" },
];

export const UGC_VOCES = [
  { key: "fem", label: "Voz femenina" },
  { key: "masc", label: "Voz masculina" },
];

// Los 5 pilares de contenido del plan.
export const UGC_PILARES = [
  { key: "liderazgo", label: "Liderazgo marca/porfolio" },
  { key: "calidad", label: "Calidad superior (que se siente)" },
  { key: "posventa", label: "Respaldo posventa" },
  { key: "elegir", label: "Elegir bien (decisión inteligente)" },
  { key: "experiencia", label: "Experiencia de uso" },
];

// Los 5 formatos core del playbook (los que mejor performan).
export const UGC_FORMATOS = [
  { key: "no_sabia", label: "No sabía esto…", hook: "Nadie te cuenta esto de…" },
  { key: "error_comun", label: "Error común", hook: "El error que hace que…" },
  { key: "comparativa", label: "Comparativa real", hook: "Mirá la diferencia entre…" },
  { key: "uso_cotidiano", label: "Uso cotidiano", hook: "Lo uso hace X meses…" },
  { key: "momento_verdad", label: "Momento de verdad", hook: "Escuchá esto…" },
];

// Escenarios/tomas para dar VARIEDAD a los videos (no siempre "hablando de
// frente"). Son atajos; además se puede escribir una escena LIBRE en texto.
export const UGC_ESCENARIOS = [
  { key: "selfie", label: "Selfie de frente" },
  { key: "sillon", label: "En el sillón" },
  { key: "compu", label: "Mirando la compu" },
  { key: "cocina", label: "En la cocina" },
  { key: "desempacando", label: "Desempacando compras" },
  { key: "lavando", label: "Al lado del lavarropas" },
  { key: "doblando", label: "Doblando ropa" },
  { key: "cafe", label: "Con un café/mate" },
];

// Call-to-action para CERRAR el guion (la marca no se dice; se manda al copy/link).
// `texto` es lo que dice la persona; también se puede escribir un CTA libre.
export const UGC_CTAS = [
  { key: "ninguno", label: "Sin CTA", texto: "" },
  { key: "copy", label: "Datos en el copy", texto: "Te dejo todos los datos acá abajo." },
  { key: "link", label: "Link abajo", texto: "Fijate el link que te dejo acá abajo." },
  { key: "privado", label: "Escribime", texto: "Cualquier cosa, escribime por privado y te cuento." },
  { key: "web", label: "Ver en la web", texto: "Mirá el modelo en la web, te dejo el link acá abajo." },
];

// Duraciones válidas para el video (Seedance acepta 4-15s). El guion se ajusta al
// mismo largo para que la persona hable todo el clip sin cortarse.
export const UGC_DURACIONES = [
  { key: "8", label: "8 seg" },
  { key: "10", label: "10 seg" },
  { key: "12", label: "12 seg" },
  { key: "15", label: "15 seg" },
];
