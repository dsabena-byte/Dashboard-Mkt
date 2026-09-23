---
name: drean-preflight
description: >-
  Pre-flight OBLIGATORIO antes de proponer, sugerir, diagnosticar o ejecutar cualquier cosa en el
  repo Dashboard-Mkt (Drean). Usalo SIEMPRE que vayas a tocar un dashboard, una query, la base de
  datos, o antes de afirmar una causa/diagnóstico — aunque el pedido parezca chico. Fuerza leer los
  gotchas de CLAUDE.md + el/los docs/ relevantes, leer el CÓDIGO/query real involucrado antes de
  tocarlo, y separar de forma explícita lo VERIFICADO (comprobado con datos o código) de lo
  INFERIDO. Existe para cortar dos vicios caros: alucinar mecanismos/causas sin comprobarlas, y
  editar de a parches sin mapear primero la estructura.
---

# Drean — pre-flight antes de actuar

La preferencia #1 del usuario es **"validá con datos, NO asumas"**. La mayoría del tiempo perdido
en este proyecto vino de romper esa regla: dar una causa como hecho sin comprobarla, o cambiar
código sin haber leído lo que ya existe. Este pre-flight es el antídoto. Corré estos pasos **antes**
de responder con un diagnóstico o de ejecutar un cambio.

## 1. Leé la memoria que aplica (no la saltees)
`CLAUDE.md` ya documenta los gotchas que costaron tiempo. Antes de tocar un área, leé su sección y
el `docs/*.md` que apunte (ej. `docs/dv360-sync.md`, `docs/mercado-gfk-carga.md`,
`docs/calendario-publicacion-meta.md`). Si el gotcha existe, es porque ya se cometió el error una vez.

## 2. Leé el código real antes de cambiarlo
Mapeá primero, editá después. Abrí el `page.tsx`, el `lib/*-queries.ts` y el componente que vas a
tocar. Entendé cómo se arma el dato hoy (fuente, gap-fill, cache, frontera server/client). Editar de
a uno "a ver si ahora sí" es exactamente lo que frustra al usuario — hace que se dé cuenta de que no
mapeaste.

## 3. Verificá TODA causa antes de afirmarla
Nunca presentes una hipótesis como hecho. Antes de decir "el problema es X":
- Consultá la DB por REST con la service key (ver skill `supabase-carga-segura` para el snippet).
- Corré el código / leé el archivo / abrí el CSV.
- Si no lo podés verificar desde el sandbox, **decilo** y marcá el mecanismo como **INFERIDO** —
  no lo escribas en la memoria ni se lo presentes al usuario como confirmado.
Caso testigo: afirmar un "bug de ventana móvil" de DV360 sin haber leído el CSV. El *qué*
(subconteo) era verificable; el *porqué* era una hipótesis. Distinguirlos evita el papelón.

## 4. Presentá VERIFICADO vs INFERIDO por separado
En tu respuesta, separá explícitamente lo comprobado de lo supuesto. Da confianza y te obliga a no
mezclar. Si algo que dijiste antes resultó mal, corregilo de forma explícita.

## 5. Compilá antes de pushear
`cd apps/web && pnpm exec tsc --noEmit`. Si tocaste la **frontera server/client** (nuevo client
component, imports cruzados), validá con `pnpm build` — `tsc` NO detecta que un `"use client"`
importe un módulo `server-only`.

## 6. Actuá con rol experto del dominio
El proyecto es analítica de marketing (Drean) sobre Next.js + Supabase. Razoná como especialista de
ese dominio, no en modo genérico: entendé qué significa el KPI, de qué fuente sale, y por qué el
usuario pide lo que pide.

## Anti-patrones a evitar
- Dar un diagnóstico "porque suena lógico" sin el dato que lo confirme.
- Empezar a codear/cargar sin haber leído el gotcha ni la query existente.
- Cambiar un mes/valor por vez cuando el problema es sistémico (mapeá y arreglá la raíz).
- Escribir en `CLAUDE.md`/`docs/` un mecanismo no confirmado como si fuera hecho.
