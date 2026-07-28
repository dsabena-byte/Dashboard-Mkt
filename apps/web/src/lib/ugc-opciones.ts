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
