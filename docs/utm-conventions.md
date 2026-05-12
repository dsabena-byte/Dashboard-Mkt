# Convenciones UTM

> **Crítico**: el funnel del dashboard joinea `ads_performance` con `web_traffic`
> usando `(fecha, utm_source, utm_medium, utm_campaign)`. Si las UTMs no son
> consistentes entre plataformas, **el funnel no funciona**.

## Reglas

1. **Lowercase siempre**. `Google` ≠ `google`.
2. **Kebab-case** para valores multi-palabra. `q2-search`, no `Q2 Search` ni `q2_search`.
3. **Sin tildes ni caracteres especiales**. `lanzamiento-mayo`, no `lanzamiento-mayó`.
4. **Tres parámetros son obligatorios**: `utm_source`, `utm_medium`, `utm_campaign`.
5. `utm_content` y `utm_term` son opcionales pero recomendados para A/B testing.

## Diccionario de valores

### `utm_source` (la plataforma donde se hace el click)

| Plataforma | Valor          |
|------------|----------------|
| Google     | `google`       |
| Facebook   | `facebook`     |
| Instagram  | `instagram`    |
| TikTok     | `tiktok`       |
| LinkedIn   | `linkedin`     |
| YouTube    | `youtube`      |
| Email      | `email`        |
| WhatsApp   | `whatsapp`     |
| Newsletter | `newsletter`   |

### `utm_medium` (tipo de medio)

| Tipo                  | Valor          |
|-----------------------|----------------|
| Búsqueda paga         | `cpc`          |
| Social paga           | `paid-social`  |
| Social orgánica       | `social`       |
| Display / banners     | `display`      |
| Email marketing       | `email`        |
| Influencer            | `influencer`   |
| Afiliados             | `affiliate`    |
| Video paga (YT, etc.) | `video`        |
| Referral              | `referral`     |

### `utm_campaign` (identifica la campaña)

Patrón sugerido: `<periodo>-<objetivo>` o `<producto>-<accion>`. Ejemplos:

- `q2-search`
- `q2-awareness`
- `lanzamiento-mayo`
- `black-friday-2026`
- `producto-x-rebrand`

### `utm_content` y `utm_term` (opcionales)

- `utm_content`: identifica la creatividad o variante (`banner-azul`, `video-15s`, `copy-a`).
- `utm_term`: palabras clave (mayormente automático en Google Ads).

## Ejemplos completos

```
?utm_source=google&utm_medium=cpc&utm_campaign=q2-search&utm_content=adgroup-marca
?utm_source=instagram&utm_medium=paid-social&utm_campaign=q2-awareness&utm_content=video-15s
?utm_source=newsletter&utm_medium=email&utm_campaign=mayo&utm_content=cta-principal
```

## Validación automática

El package `@dashboard/shared` exporta `validateUtm()` para chequear que un
conjunto de UTMs cumpla la convención antes de publicarlas:

```ts
import { validateUtm } from "@dashboard/shared";

const result = validateUtm({
  source: "Google",      // ❌ debería ser "google"
  medium: "cpc",
  campaign: "Q2 Search", // ❌ debería ser "q2-search"
});

console.log(result);
// { valid: false, errors: ["utm_source=\"Google\" no cumple…", …] }
```

## Qué hacer si una plataforma manda UTMs raras

- **Google Ads**: configurar **auto-tagging OFF** y poner UTMs manuales con el
  template `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign=...` para
  controlar el formato. Si dejás auto-tagging ON, GA4 usa `gclid` y no hay
  `utm_*` (más data, pero no joinea fácil con otras fuentes).
- **Meta Ads**: configurar a nivel ad set en "URL parameters".
- **N8N de ingesta**: aplicar `normalizeUtmValue()` antes de insertar a la DB
  para defendernos de errores humanos.
