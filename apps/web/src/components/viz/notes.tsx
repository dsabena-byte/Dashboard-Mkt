"use client";
import { createContext, useContext } from "react";
import type { Anotacion } from "@/lib/anotaciones-core";

// Anotaciones del tablero (y de toda la cuenta) para dibujar marcas en los gráficos por fecha.
// El runtime las provee; los gráficos las leen sin prop drilling. Vacío = sin marcas.
export const VizNotesContext = createContext<Anotacion[]>([]);
export const useVizNotes = () => useContext(VizNotesContext);
