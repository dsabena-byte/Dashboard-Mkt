---
title: "Market Intelligence & Competitive Performance 2026 — Diagnóstico"
subtitle: "Drean · Lavado, Refrigeración y Cocción · GfK enero–julio 2026 vs 2025 e histórico"
---

## En una frase

Drean es #1 en unidades en Lavado y Refrigeración y #4 en Cocción. En Lavado pierde share de forma sostenida frente a retadores de precio, con Philco a la cabeza. En Refrigeración la caída se frenó en 2026. Cocción es su motor de crecimiento: el share se triplicó en un año, con precio premium.

## 1. Auditoría de datos (etapa 1–2)

| Tema | Estado | Detalle |
|---|---|---|
| Fuente | GfK "Brands Timeseries" | Tabla `mercado_share`: 9.311 filas, extracto REST del 19-oct-2026 (copia en `datos/`). |
| Métricas | Share en unidades, share en valor e índice de precio | Por marca, categoría y segmento (Low/Mid/High + Total), mensual y MAT. |
| Volumen, valor y precio del mercado | **No disponibles** | La fila "Market" del export de GfK se descarta al cargar. Sin tamaño de mercado. |
| Mercado global | **No calculable** | Sin volúmenes no se puede ponderar por categoría. No se suman ni promedian shares. |
| 2026 | Ene–jul | Ago–dic sin datos. Agosto y septiembre todavía no están cargados. |
| 2025 mismo mes | Parcial | Lavado total: unidades ene–jul (abril sin dato); share en valor e índice recién desde jul-25. Refrigeración y Cocción total: solo jul-25. Segmentos: desde abr-25. |
| YTD 2026 vs YTD 2025 | **No calculable** | Requiere unidades por mes. Se usa el MAT a jul-26 vs jul-25 (calculado por GfK sobre volúmenes, sin promediar shares). |
| Real vs nominal | No aplica | Share e índice de precio son relativos y no dependen de la inflación. |

**Validaciones** (todas las comprobaciones están en `analisis.py`):

- Sin duplicados.
- Cada mes del Total 2026 suma 100% (assert).
- El índice de precio coincide con share en valor ÷ share en unidades × 100: mediana de la diferencia 0,0; percentil 90 de la diferencia en valor absoluto 0,47; n = 3.142.
- Se excluyen las filas MAT de nov-2026, que son una proyección cargada a futuro.

**Diferencias de metodología:**

- Refrigeración y Cocción MAT antes de jul-25 listan menos marcas: los shares de esas marcas suman 78–89%. El share de cada marca sigue siendo share del mercado total y es comparable.
- Cocción "alto" se redefinió en ago-2026 (57 cm o más).
- El Total de Lavado podría incluir semiautomáticos, porque los segmentos se arman sobre automáticos [sin verificar]. Por eso los segmentos no se reconstruyen sumando.
- Se intentó inferir el peso de cada segmento por regresión entre marcas. Dio pesos inestables y negativos, así que se descartó: no hay mezcla de segmentos medida.

**Lectura:**

- El mensual es volátil: un mes puede moverse 3–5 pp.
- Las conclusiones de tendencia se apoyan en el MAT.
- "Correlación" marca coincidencias temporales que no prueban causa.

## 2. Mercado global

No se puede calcular un share global ni un índice de precio ponderado (ver hallazgo 18). Posición de Drean por categoría (MAT jul-26 vs MAT jul-25). El ranking no cuenta "Otras":

| Categoría | Unidades | Δ | Valor | Δ | Índice de precio | Δ | Rank unidades |
|---|--:|--:|--:|--:|--:|--:|--:|
| Lavado | 26,6% | −6,1 pp | 26,1% | −7,7 pp | 98 | −5 | #1 |
| Refrigeración | 18,5% | −2,0 pp | 16,2% | −2,5 pp | 88 | −3 | #1 |
| Cocción | 9,9% | +6,9 pp | 12,1% | +8,4 pp | 122 | 0 | #3 |

Las tres categorías van en direcciones opuestas: Lavado cae, Refrigeración se estabiliza y Cocción crece. Un número global escondería esto.

## 3. Lavado

**A. Evolución del mercado.** Sin datos de volumen ni de valor del mercado.

**B. Share en unidades.**
- MAT: 39,3% (ene-24) → 32,7% (jul-25) → 26,6% (jul-26).
- El MAT bajó todos los meses salvo feb-24 y feb-25.
- Cada mes de ene–jul 2026 quedó debajo del mismo mes de 2025: ene −9,4 pp, feb −13,4, mar −6,2, may −7,5, jun −7,7, jul −3,0.
- Jul-26 vs dic-25: −5,1 pp.

**C. Share en valor.** MAT 33,9% → 26,1% (−7,7 pp), cae más que unidades.

**D. Índice de precio.**
- MAT 103 → 98.
- En el mensual 2026 se recuperó a 96–102 (vs 93–96 en jul–sep 2025).

**E. Lectura conjunta.**
- En el año móvil Drean perdió volumen y también posición de precio.
- En 2026 recuperó precio, pero no share.

**F. Segmentos (MAT).**

| Segmento | Share de Drean | Índice | Posición | Movimientos |
|---|---|---|---|---|
| Bajo (≤7,4 kg) | 42,5% → 26,8% (−15,8 pp) | 103 → 109 | #1 | Mensual ene-25 52,7% → ene-26 25,9%. Ganan Philco (+7,8), Kanjihome (+3,6) y BGH (+2,4). |
| Medio (7,5–8,9 kg) | 36,7% (−4,6 pp) | 110 | #1 | Jul-26 mensual 42,4%. Midea +6,9 pp. |
| Alto (≥9 kg) | 14,0% (−4,9 pp) | 101 | #3 | Philco 6,7% → 30,4% (índice 84) es el nuevo líder. Samsung −11,1 pp y Whirlpool −17,9 pp. |

**G. Competidores.**
- Ganan: Philco +9,2 pp (#2, a 10,4 pp de Drean y a 2,0 pp en jun-26), Midea +2,8, LG +2,3, Smartlife +2,3, Kanjihome +2,0.
- Pierden: Samsung −5,2 y Whirlpool −4,3.

## 4. Refrigeración

**A. Evolución del mercado.** Sin datos de volumen ni de valor del mercado.

**B. Share en unidades.**
- MAT: 26,0% (ene-24) → 20,4% (jul-25) → 18,6% (dic-25) → 18,5% (jul-26).
- Sube en may–jul 2026: son las primeras subidas desde oct-24.
- Mensual 2026: 17,9–20,2%. Jul-26 20,2% (+5,0 pp vs jul-25; +2,5 pp vs dic-25).
- Ene–jun 2025 mensual sin datos.

**C. Share en valor.** MAT 18,7% → 16,2% (−2,5 pp).

**D. Índice de precio.** MAT 91 → 88; mensual 2026 entre 82 y 89.

**E. Lectura conjunta.** Drean es líder en volumen con precio bajo el promedio del mercado. Eso se explica por la mezcla de segmentos, porque dentro del segmento básico es premium.

**F. Segmentos (MAT).**

| Segmento | Share de Drean | Índice | Posición | Movimientos |
|---|---|---|---|---|
| Sin no-frost | 28,7% (+0,7 pp) | 117 | #1 | Mensual 2026: 29–34%, vs 23,6–29,1% en abr–jul 2025. |
| No-frost medio | 9,9% | — | #4 | Samsung −13,2 pp, Gafa +5,7 y Midea +6,6. |
| No-frost alto | 1,8% | — | #11 | Philco +7,7 (índice 78), BGH +12,7 (índice 75), Samsung −16,9 y Whirlpool −11,0. |

**G. Competidores.**
- Ganan: Midea +3,9 pp, BGH +3,2, Philco +2,5, Telefunken +2,5, Smartlife +2,3.
- Pierden: Marcas propias −4,9, Samsung −4,3, Whirlpool −2,7.

## 5. Cocción

**A. Evolución del mercado.** Sin datos de volumen ni de valor del mercado.

**B. Share en unidades.**
- MAT: 3,2% (ene-24) → 1,7% (ene-25) → 3,0% (jul-25) → 9,9% (jul-26), con 19 subas mensuales seguidas.
- Mensual: jul-25 7,5% → dic-25 8,2% → jul-26 11,7%.

**C. Share en valor.** MAT 3,7% → 12,1% (+8,4 pp); jul-26 mensual 15,8%.

**D. Índice de precio.** MAT 122 sin cambio; jul-26 mensual 136.

**E. Lectura conjunta.** Drean crece en volumen y en valor a la vez, con precio premium. Es una ganancia de calidad, no de descuento.

**F. Segmentos (MAT).**

| Segmento | Share de Drean | Índice | Posición |
|---|---|---|---|
| Medio (55–56 cm) | 5,0% → 16,1% | 113 | #3 |
| Alto (≥57 cm) | 0,9% → 5,3% | 97 | — |
| Bajo (≤54 cm) | 0,1% | — | Drean prácticamente no está |

**G. Competidores.**
- Escorial: 38,9% → 31,3% (−7,6 pp). Cede −6,2 pp en el segmento medio y −11,1 pp en el bajo.
- Philco +3,0 y Electrolux +1,5.

## 6. Análisis transversal

- **Matriz competitiva.** Philco gana en las tres categorías. Samsung y Whirlpool pierden en todas donde compiten. Midea y Smartlife ganan en Lavado y Refrigeración.
- **Ganadores.** Philco Lavado +9,2, Drean Cocción +6,9 y Midea Refrigeración +3,9.
- **Perdedores.** Escorial Cocción −7,6, Drean Lavado −6,1 y Samsung Lavado −5,2.
- **Dinámica.** Los segmentos premium (Lavado carga alta, Refrigeración no-frost alto) los ganan marcas con precio 16–25% bajo el mercado.
- **Pricing.** El índice de Drean es mayor a 100 dentro de cada segmento de Lavado y en el segmento básico de Refrigeración. El índice total queda en 100 o menos por la mezcla. En Cocción pasa lo inverso.
- **Diagnóstico de Drean:**
  - Defensor en Lavado: líder bajo ataque.
  - Líder estabilizado en Refrigeración, sin presencia en no-frost.
  - Retador ganador en Cocción.

## 7. Implicancias 2027

1. Defender Lavado (segmento bajo y carga alta) frente a Philco. Antes, validar con sell-out la hipótesis de precio.
2. Entrar en no-frost en Refrigeración.
3. Escalar Cocción cuidando el índice premium.
4. Gestionar el índice de precio por segmento.
5. Seguimiento dedicado a Philco.
6. Completar la base de mercado:
   - agosto y septiembre;
   - la fila "Market" (unidades y facturación);
   - ene–jun 2025 mensual de Refrigeración y Cocción.

## 8. Matriz de insights

**1. Drean sigue primero en Lavado, pero perdió 6,1 pp de share en unidades en un año** (Lavado · Hecho · confianza Alta)

- *Evidencia:* Share en unidades MAT: 32,7% a jul-25 y 26,6% a jul-26. En ene–jul 2026 cada mes quedó por debajo del mismo mes de 2025: ene −9,4 pp, feb −13,4, mar −6,2, may −7,5, jun −7,7 y jul −3,0 (abril 2025 sin dato).
- *Comparación:* MAT jul-26 vs jul-25; mensual 2026 vs 2025
- *Interpretación:* Es una caída sostenida y no un mes malo: el MAT bajó todos los meses desde enero de 2024, salvo febrero de 2024 y febrero de 2025 (era 39,3%).
- *Implicancia:* Recuperar share en Lavado es la prioridad comercial número uno de 2027.

**2. Philco es el retador directo: la distancia con Drean bajó de 25,7 a 10,4 pp** (Lavado · Hecho · confianza Alta)

- *Evidencia:* Philco pasó de 7,0% a 16,2% MAT en unidades (+9,2 pp), la mayor ganancia de la categoría. En junio de 2026 quedó a 2,0 pp de Drean en el mes (22,0% vs 20,0%).
- *Comparación:* MAT jul-26 vs jul-25; mensual jun-26
- *Interpretación:* El liderazgo de Drean en unidades está en riesgo en el corto plazo.
- *Implicancia:* Seguir a Philco mes a mes, por segmento y por canal, y preparar una respuesta comercial.

**3. La mayor pérdida está en el segmento bajo (hasta 7,4 kg): −15,8 pp** (Lavado · Hecho · confianza Alta)

- *Evidencia:* Drean en el segmento bajo: 42,5% a 26,8% MAT. Mensual: 52,7% en ene-25 y 25,9% en ene-26. En ese segmento ganan Philco (+7,8 pp), Others (+4,0), Kanjihome (+3,6) y BGH (+2,4).
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* El segmento donde Drean era más fuerte es el que más se fragmentó, a favor de marcas de menor precio.
- *Implicancia:* Revisar surtido, precio y promoción del segmento bajo frente a Philco y las marcas de precio.

**4. En el segmento bajo, Drean perdió share mientras su precio relativo subió** (Lavado · Correlación · confianza Media)

- *Evidencia:* Índice de precio de Drean en el segmento bajo: 103 a 109 (MAT), con −15,8 pp de share. Philco opera con un índice de 82 y Kanjihome con 65.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* Coinciden en el tiempo una brecha de precio mayor y la pérdida de share. Es una correlación: el dato no prueba que el precio sea la causa (también pueden influir distribución, surtido y promociones).
- *Implicancia:* Hipótesis a validar con sell-out por canal y precio de góndola: la brecha de precio con los retadores explica parte de la pérdida.

**5. En carga alta (9 kg o más) el mercado cambió de líder: Philco 30,4%, y Samsung y Whirlpool se desplomaron** (Lavado · Hecho · confianza Alta)

- *Evidencia:* Segmento alto MAT: Philco 6,7% a 30,4% (+23,7 pp) con índice 84; Samsung −11,1 pp; Whirlpool −17,9 pp. Drean −4,9 pp a 14,0% (#3), con índice 101.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* El segmento premium se volvió una pelea de precio: lo gana la marca más barata del segmento (Philco, índice 84) y pierden las marcas globales.
- *Implicancia:* Definir si Drean compite en carga alta por precio o por diferenciación; con índice 101 hoy no está en ninguno de los dos extremos.

**6. El segmento medio sostiene el liderazgo y repuntó en julio de 2026** (Lavado · Hecho · confianza Media)

- *Evidencia:* Segmento medio: Drean 36,7% MAT (#1; −4,6 pp). Mensual: 42,4% en jul-26 vs 25,0% en jul-25 y 37,4% en dic-25. Midea gana +6,9 pp.
- *Comparación:* MAT y mensual jul-26 vs jul-25 y vs dic-25
- *Interpretación:* Es el segmento más defendido. El pico de julio es un solo mes y falta confirmar que se sostenga.
- *Implicancia:* Validar con agosto y septiembre (todavía no cargados) antes de leerlo como tendencia.

**7. El share en valor cayó más que en unidades: Drean perdió posición de precio en el año móvil** (Lavado · Hecho · confianza Alta)

- *Evidencia:* MAT: valor 33,9% a 26,1% (−7,7 pp) vs unidades −6,1 pp; índice de precio 103 a 98. En el mensual 2026 el índice se recuperó (96 a 102 en ene–jul, vs 93–96 en jul–sep 2025).
- *Comparación:* MAT jul-26 vs jul-25; mensual 2026 vs jul–sep 2025
- *Interpretación:* En el año móvil Drean vendió por debajo del precio promedio del mercado; en 2026 volvió a la paridad.
- *Implicancia:* La recuperación de precio de 2026 no frenó la caída de share: precio y volumen hay que gestionarlos juntos.

**8. En Refrigeración, Drean lidera y la caída se frenó en 2026** (Refrigeración · Hecho · confianza Media)

- *Evidencia:* MAT en unidades: 26,0% (ene-24) a 18,6% (dic-25), 18,5% (jul-26). El MAT subió en mayo, junio y julio de 2026, las primeras subidas desde octubre de 2024. Mensual jul-26: 20,2% vs 15,2% en jul-25 (+5,0 pp) y 17,7% en dic-25 (+2,5 pp).
- *Comparación:* MAT histórico; mensual jul-26 vs jul-25 y vs dic-25
- *Interpretación:* La tendencia pasó de caída a estabilidad con leve recuperación. Ene–jun 2025 mensual no está en la base, así que la comparación interanual mensual solo es posible para julio.
- *Implicancia:* Sostener lo que funcionó en 2026 en Refrigeración y medir si la recuperación mensual se traslada al año móvil.

**9. Drean vende Refrigeración por debajo del precio promedio del mercado** (Refrigeración · Hecho · confianza Alta)

- *Evidencia:* Índice de precio MAT: 91 a 88; share en valor 16,2% vs 18,5% en unidades (MAT jul-26). Mensual 2026 entre 82 y 89.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* Drean gana volumen con un precio promedio menor que el mercado: su participación en la facturación de la categoría es menor que en unidades.
- *Implicancia:* Evaluar la mezcla de productos: el índice bajo viene sobre todo de la composición por segmento (ver hallazgo 15).

**10. La fortaleza de Drean está en el segmento sin no-frost; en no-frost tiene poca presencia** (Refrigeración · Hecho · confianza Alta)

- *Evidencia:* Sin no-frost: 28,7% MAT (#1; +0,7 pp; índice 117) y 29–34% mensual en 2026 vs 23,6–29,1% en abr–jul 2025. No-frost medio: 9,9% (#4). No-frost alto: 1,8% (#11).
- *Comparación:* MAT jul-26 vs jul-25; mensual 2026 vs 2025
- *Interpretación:* Drean es líder y premium en el segmento básico, y marginal en no-frost.
- *Implicancia:* El crecimiento en Refrigeración depende de entrar en no-frost; hoy ese mercado se lo reparten otras marcas.

**11. En no-frost alto, Philco y BGH desplazan a Samsung y Whirlpool con precios 22–25% bajo el mercado** (Refrigeración · Hecho · confianza Alta)

- *Evidencia:* Segmento alto MAT: Philco +7,7 pp (20,8%, índice 78), BGH +12,7 pp (14,8%, índice 75), Samsung −16,9 pp (14,3%, índice 140), Whirlpool −11,0 pp (12,2%).
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* Es el mismo patrón que en Lavado carga alta: el segmento premium se abarata y lo ganan los retadores de precio.
- *Implicancia:* Hay una ventana de entrada en no-frost para una marca local con precio competitivo.

**12. Cocción es la categoría donde Drean más crece: de 3,0% a 9,9% en un año** (Cocción · Hecho · confianza Alta)

- *Evidencia:* MAT en unidades +6,9 pp (#3 entre marcas) y en valor 3,7% a 12,1% (+8,4 pp), el mayor avance de la categoría. Mensual: 7,5% en jul-25 y 11,7% en jul-26 (valor 15,8%). El MAT subió 19 meses seguidos.
- *Comparación:* MAT jul-26 vs jul-25; mensual jul-26 vs jul-25 y vs dic-25 (+3,4 pp)
- *Interpretación:* Es una ganancia sostenida y no un pico.
- *Implicancia:* Cocción es la plataforma de crecimiento: sostener la inversión y el surtido.

**13. Drean crece en Cocción con precio premium y en los segmentos medio y alto** (Cocción · Hecho · confianza Alta)

- *Evidencia:* Índice de precio total MAT 122 (jul-26 mensual: 136). Segmento medio (55–56 cm): 5,0% a 16,1% (#3, índice 113). Segmento alto (57 cm o más): 0,9% a 5,3% (índice 97). Segmento bajo: 0,1% (sale).
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* El crecimiento no se apoya en el precio: Drean se ubica en los anchos de más valor. Su share en valor (12,1%) supera al de unidades (9,9%).
- *Implicancia:* Cuidar el posicionamiento premium mientras escala. El segmento bajo no es prioritario.

**14. El líder Escorial pierde 7,6 pp, la mayor caída de la categoría** (Cocción · Correlación · confianza Media)

- *Evidencia:* Escorial: 38,9% a 31,3% MAT (−7,6 pp); en el segmento bajo, 71,6% a 60,5%. En el segmento medio cede −6,2 pp, donde Drean gana +11,1.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* En el segmento medio, lo que pierde Escorial y lo que gana Drean coinciden en el tiempo. Sin datos de sell-out no se puede afirmar que sea transferencia directa.
- *Implicancia:* Escorial es el competidor a seguir en Cocción, segmento medio.

**15. Drean es premium dentro de cada segmento, pero su índice total queda en 100 o menos por la mezcla** (Transversal · Hecho · confianza Alta)

- *Evidencia:* Índices de Drean dentro de cada segmento (MAT): Lavado bajo 109 y medio 110; Refrigeración sin no-frost 117. Índice total: Lavado 98 y Refrigeración 88. En Cocción pasa lo inverso: 113 y 97 por segmento, 122 total.
- *Comparación:* MAT jul-26
- *Interpretación:* Es un efecto de composición: Drean concentra su venta en los segmentos de menor precio de Lavado y Refrigeración, y en los de mayor precio de Cocción. El índice total no dice que Drean sea "barato".
- *Implicancia:* Leer siempre el índice de precio por segmento, no solo el total.

**16. Philco es el retador común: gana share en las tres categorías** (Transversal · Hecho · confianza Alta)

- *Evidencia:* MAT en unidades: Lavado +9,2 pp, Refrigeración +2,5 pp y Cocción +3,0 pp. Es #2 en Lavado y #3 en Refrigeración.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* Es el único competidor que avanza en las tres categorías a la vez.
- *Implicancia:* Armar un seguimiento competitivo dedicado a Philco: precio, surtido, canales y pauta.

**17. Las marcas premium globales retroceden en todo el mercado y ganan los retadores de precio** (Transversal · Hecho / hipótesis · confianza Media)

- *Evidencia:* Samsung: Lavado −5,2 pp y Refrigeración −4,3 pp. Whirlpool: −4,3 y −2,7 pp. Ganan Midea (+2,8 y +3,9; índice 106 y 102) y Smartlife (+2,3 y +2,3; índice 99 y 93). BGH también gana (+1,7 y +3,2), aunque en Refrigeración con índice 125.
- *Comparación:* MAT jul-26 vs jul-25
- *Interpretación:* La demanda se movió hacia marcas de precio medio y bajo. Es consistente con un consumidor más sensible al precio; los datos de share no miden esa causa.
- *Implicancia:* En 2027 la competencia de Drean es cada vez más de precio y menos de marca global.

**18. No se puede calcular un share global de Drean con la base actual** (Global · Limitación · confianza —)

- *Evidencia:* mercado_share guarda solo participaciones e índices. No guarda unidades, facturación ni precio absoluto del mercado: la fila "Market" de los exports de GfK se descarta al cargar.
- *Comparación:* —
- *Interpretación:* Sumar o promediar shares de categorías distintas daría un número sin sentido, por eso no se calcula.
- *Implicancia:* Cargar la fila "Market" (unidades y facturación del mercado) en la próxima carga de GfK. Con eso se calculan el share global, el índice ponderado y la contribución por categoría.

## Anexo — tablas de cálculo

#### Lavado — ranking MAT jul-26 (todas las marcas listadas)

| Marca | Unid. % | Δ pp | Valor % | Δ pp | Índ. precio | Δ pts | Jul-26 unid. (mes) | vs dic-25 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| DREAN | 26,6 | -6,1 | 26,1 | -7,7 | 98,0 | -5,0 | 24,9 | -5,1 |
| PHILCO | 16,2 | +9,2 | 16,1 | +10,2 | 100,0 | +15,0 | 19,1 | +5,8 |
| Otras | 14,1 | -6,2 | 11,0 | -1,9 | 78,0 | +15,0 | 16,5 | -2,1 |
| SAMSUNG | 6,8 | -5,2 | 10,7 | -7,1 | 158,0 | +9,0 | 5,7 | -1,3 |
| CODINI | 5,8 | +0,5 | 2,6 | +0,5 | 45,0 | +6,0 | 5,5 | -1,1 |
| BGH | 4,8 | +1,7 | 4,9 | +1,7 | 101,0 | -2,0 | 2,6 | -3,1 |
| WHIRLPOOL | 4,5 | -4,3 | 6,3 | -6,3 | 141,0 | -3,0 | 3,9 | 0,0 |
| MIDEA | 4,5 | +2,8 | 4,7 | +3,0 | 106,0 | +4,0 | 7,8 | +6,0 |
| LG | 4,2 | +2,3 | 6,5 | +3,1 | 156,0 | -20,0 | 2,5 | -3,4 |
| SMARTLIFE | 3,9 | +2,3 | 3,8 | +2,5 | 99,0 | +16,0 | 5,1 | +2,6 |
| KANJIHOME | 3,7 | +2,0 | 1,9 | +1,1 | 52,0 | +2,0 | — | — |
| CANDY | 3,5 | +0,7 | 4,4 | +0,5 | 128,0 | -12,0 | — | — |
| Marcas propias | 1,6 | +0,5 | 0,9 | +0,5 | 56,0 | +21,0 | 1,1 | -1,3 |

#### Lavado — Drean mensual 2026 vs 2025 (Total)

| Métrica | Año | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Unidades % | 2026 | 27,8 | 25,4 | 27,9 | 25,5 | 22,3 | 22,0 | 24,9 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Unidades % | 2025 | 37,2 | 38,8 | 34,1 | Sin datos | 29,8 | 29,7 | 27,9 | 30,5 | 29,5 | 31,7 | 26,5 | 30,0 |
| Valor % | 2026 | 27,4 | 25,9 | 26,9 | 24,8 | 21,5 | 21,9 | 25,4 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Valor % | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 26,2 | 28,5 | 28,3 | 31,4 | 27,2 | 29,8 |
| Índice | 2026 | 99,0 | 102,0 | 97,0 | 97,0 | 96,0 | 99,0 | 102,0 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Índice | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 94,0 | 93,0 | 96,0 | 99,0 | 103,0 | 99,0 |

#### Refrigeración — ranking MAT jul-26 (todas las marcas listadas)

| Marca | Unid. % | Δ pp | Valor % | Δ pp | Índ. precio | Δ pts | Jul-26 unid. (mes) | vs dic-25 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| DREAN | 18,5 | -2,0 | 16,2 | -2,5 | 88,0 | -3,0 | 20,2 | +2,5 |
| GAFA | 14,8 | +0,4 | 12,8 | +0,3 | 87,0 | 0,0 | 15,2 | +2,7 |
| Otras | 12,8 | -0,5 | 11,9 | -0,1 | 93,0 | +2,0 | 11,8 | -4,0 |
| PHILCO | 11,5 | +2,5 | 9,8 | +3,1 | 86,0 | +11,0 | 6,3 | -7,5 |
| SAMSUNG | 9,7 | -4,3 | 15,5 | -5,9 | 160,0 | +7,0 | 8,7 | 0,0 |
| WHIRLPOOL | 8,2 | -2,7 | 10,5 | -3,6 | 128,0 | -2,0 | 9,1 | +2,6 |
| MIDEA | 4,5 | +3,9 | 4,6 | +3,7 | 102,0 | -48,0 | 7,6 | +1,9 |
| ELECTROLUX | 4,0 | +0,2 | 5,8 | +1,0 | 145,0 | +17,0 | 5,4 | +2,5 |
| TELEFUNKEN | 3,7 | +2,5 | 1,8 | +1,3 | 49,0 | +4,0 | 2,6 | -2,5 |
| Marcas propias | 3,6 | -4,9 | 2,6 | -3,0 | 72,0 | +6,0 | 2,5 | -1,8 |
| BGH | 3,5 | +3,2 | 4,3 | +4,1 | 125,0 | +13,0 | 2,6 | -0,3 |
| NEBA | 3,2 | -0,8 | 2,1 | -0,5 | 65,0 | 0,0 | 2,6 | -0,1 |
| SMARTLIFE | 2,3 | +2,3 | 2,1 | +2,1 | 93,0 | — | 5,2 | +3,9 |

#### Refrigeración — Drean mensual 2026 vs 2025 (Total)

| Métrica | Año | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Unidades % | 2026 | 19,0 | 19,5 | 19,8 | 20,1 | 17,9 | 18,2 | 20,2 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Unidades % | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 15,2 | 16,1 | 16,3 | 19,4 | 17,4 | 17,7 |
| Valor % | 2026 | 16,5 | 16,5 | 16,2 | 17,0 | 15,1 | 16,1 | 17,9 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Valor % | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 14,2 | 15,1 | 15,1 | 17,4 | 15,1 | 16,2 |
| Índice | 2026 | 87,0 | 85,0 | 82,0 | 85,0 | 84,0 | 88,0 | 89,0 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Índice | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 94,0 | 94,0 | 92,0 | 89,0 | 87,0 | 92,0 |

#### Cocción — ranking MAT jul-26 (todas las marcas listadas)

| Marca | Unid. % | Δ pp | Valor % | Δ pp | Índ. precio | Δ pts | Jul-26 unid. (mes) | vs dic-25 |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| ESCORIAL | 31,3 | -7,6 | 21,7 | -4,8 | 69,0 | +1,0 | 32,4 | +1,5 |
| FLORENCIA | 15,6 | -0,5 | 13,4 | -1,2 | 86,0 | -5,0 | 15,8 | -1,1 |
| Otras | 14,6 | +0,8 | 16,2 | -1,4 | 112,0 | -16,0 | 14,7 | -2,7 |
| DREAN | 9,9 | +6,9 | 12,1 | +8,4 | 122,0 | 0,0 | 11,7 | +3,4 |
| LONGVIE | 4,2 | -1,1 | 6,2 | -2,0 | 148,0 | -6,0 | 3,7 | -0,5 |
| PHILCO | 4,1 | +3,0 | 3,1 | +1,8 | 74,0 | -31,0 | 3,5 | -2,0 |
| WHIRLPOOL | 4,0 | +0,2 | 6,5 | -0,1 | 163,0 | -11,0 | 3,7 | -0,2 |
| ELECTROLUX | 3,2 | +1,5 | 7,3 | +3,2 | 224,0 | -12,0 | — | — |
| ORBIS | 3,2 | -0,4 | 4,0 | -0,7 | 125,0 | -4,0 | 2,4 | -1,3 |
| MORELLI | 3,0 | -0,2 | 4,1 | -0,5 | 137,0 | -9,0 | 3,5 | +1,1 |
| PEABODY | 2,7 | -0,3 | 1,6 | -0,1 | 58,0 | +1,0 | 2,3 | -0,3 |
| VOLCAN | 2,7 | -1,6 | 2,7 | -1,8 | 101,0 | -4,0 | — | — |
| Marcas propias | 1,4 | -0,7 | 1,1 | -0,7 | 84,0 | -7,0 | 1,1 | -0,3 |

#### Cocción — Drean mensual 2026 vs 2025 (Total)

| Métrica | Año | Ene | Feb | Mar | Abr | May | Jun | Jul | Ago | Sep | Oct | Nov | Dic |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Unidades % | 2026 | 9,2 | 8,9 | 9,5 | 10,2 | 10,9 | 11,0 | 11,7 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Unidades % | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 7,5 | 8,3 | 8,6 | 10,2 | 10,4 | 8,2 |
| Valor % | 2026 | 11,7 | 11,6 | 12,0 | 12,6 | 13,1 | 14,1 | 15,8 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Valor % | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 8,0 | 8,8 | 9,2 | 11,2 | 11,2 | 10,3 |
| Índice | 2026 | 127,0 | 131,0 | 126,0 | 123,0 | 120,0 | 128,0 | 136,0 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos |
| Índice | 2025 | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | Sin datos | 107,0 | 106,0 | 106,0 | 110,0 | 108,0 | 125,0 |
