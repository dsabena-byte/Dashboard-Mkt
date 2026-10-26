# CB Ventas · re-apuntar el Office Script del Excel "FC + BO" a Dashboard-Mkt

El Office Script embebido en el Excel de Ventas (SharePoint) hoy manda las ventas a la app vieja
(`cuadros-basicos.vercel.app`). Para que alimente el tablero nuevo **/cb-ventas** de Dashboard-Mkt hay que
cambiar 4 cosas en el script. El formato de lo que manda (tablas FC, BO, FC_FOB, BO_FOB) **no cambia**.

## Antes (lo hace quien administra Vercel)
1. En Vercel → proyecto Dashboard-Mkt → Settings → Environment Variables, crear **`CB_VENTAS_INGESTA_SECRET`**
   (Production) con una clave larga al azar (mínimo 16 caracteres; con menos el tablero rechaza todo) y redeployar.
2. Pasarle esa clave a quien edita el Excel por un canal privado (nunca por mail ni chat abiertos).

## En el Excel (Automatizar → el script de sincronización → Editar)
1. En `CONFIG`:
   - `apiBase: "https://dashboard-mkt-seven.vercel.app"`
   - `secret: "<la clave nueva CB_VENTAS_INGESTA_SECRET>"`
2. Buscar la línea que pide los pares del cuadro básico (`fetch(\`${CONFIG.apiBase}/api/cb-pairs?secret=...`) y
   reemplazarla por (la clave ya no va en la dirección, va en un encabezado):
   ```ts
   const cbRes = await fetch(`${CONFIG.apiBase}/api/cb-ventas/pares`, { headers: { "x-refresh-secret": CONFIG.secret } });
   ```
3. Buscar `fetch(\`${CONFIG.apiBase}/api/ventas\`` y cambiar solo la ruta a **`/api/cb-ventas/ingesta`**
   (el encabezado `x-refresh-secret` y el resto quedan igual).
4. Guardar y **Ejecutar**. En la consola tiene que decir `Sync OK` con la cantidad de filas (`rows`, `fc`, `bo`).

## Cómo verificar
- Abrir `/cb-ventas`: debajo de las pestañas dice "Última carga de ventas: <fecha y hora>".
- Si sale `401`: la clave no coincide (o falta la variable en Vercel / no se redeployó).
- Si sale `409 El cuadro básico está vacío`: falta sembrar clientes y cuadro básico (ruta `cb-ventas-migrar` o
  subir los CSV en las pestañas Clientes / Cuadro básico y homólogos).

## Qué hace el tablero con lo que llega
Igual que la app vieja: descarta lo que no está en el cuadro básico (cliente + modelo u homólogo), normaliza
fechas (AAAAMMDD, período SAP AAAANNN, dd/mm/aaaa), usa la razón social del catálogo y **reemplaza todas las
ventas** de una vez (si algo falla, quedan las anteriores).
