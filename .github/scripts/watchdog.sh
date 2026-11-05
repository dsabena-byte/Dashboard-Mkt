#!/usr/bin/env bash
# Watchdog de Drean: DETECTA (runs fallados + datos sin actualizar), DIAGNOSTICA (log del paso que falló) y
# CORRIGE solo lo que se puede sin gastar de más (reintento / relanzar). Lo que necesita código o una
# credencial queda en el issue con la etiqueta `watchdog-agente` para el agente de monitoreo.
# Requiere: GH_TOKEN, GH_REPO, CRON_SECRET, HEALTH_URL; corre con el repo checkouteado.
set -uo pipefail

# Syncs que COMPRAN datos (DataForSEO / Apify / OpenAI con búsqueda): relanzarlos vuelve a comprar.
PAGOS=" seo-sync.yml trends-sync.yml llmo-sync.yml ad-library.yml competencia-social.yml "
# Pagos que REANUDAN (no recompran lo ya guardado): se pueden relanzar 1 vez cada 20 h.
REANUDABLES=" seo-sync.yml "
SKIP=" watchdog.yml publicar-contenido.yml "

PROBLEMAS=""   # lo que se arregló solo (informativo)
AGENTE=""      # lo que necesita al agente (código) o al user (saldo/credencial)

causa_de() {   # clasifica el log del paso que falló
  local log="$1"
  if grep -qiE 'payment required|sin saldo|insufficient_quota|hard limit|usage limit|40200' <<<"$log"; then echo saldo
  elif grep -qiE 'invalid_grant|unauthorized|\b401\b|\b403\b|token (expired|inv)|OAuthException|credenciales' <<<"$log"; then echo credencial
  elif grep -qiE 'exit code 28|operation timed out|timed out|FUNCTION_INVOCATION_TIMEOUT|\b504\b' <<<"$log"; then echo timeout
  elif grep -qiE '\b50[023]\b|ECONNRESET|fetch failed|socket hang up|rate limit|\b429\b' <<<"$log"; then echo temporal
  else echo desconocido; fi
}

relanzado_reciente() {  # ¿ya hubo un dispatch de este workflow en las últimas N horas?
  local wf="$1" horas="$2" desde
  desde=$(date -u -d "-${horas} hours" +%Y-%m-%dT%H:%M:%SZ)
  [ -n "$(gh run list --workflow "$wf" --event workflow_dispatch --created ">=$desde" --limit 1 --json databaseId --jq '.[0].databaseId // ""' 2>/dev/null)" ]
}

relanzar() {  # $1 wf · devuelve el texto de la acción
  local wf="$1"
  if [[ "$PAGOS" == *" $wf "* && "$REANUDABLES" != *" $wf "* ]]; then echo "no se relanza solo (vuelve a comprar datos)"; return 1; fi
  if relanzado_reciente "$wf" 20; then echo "ya se relanzó en las últimas 20 h"; return 1; fi
  gh workflow run "$wf" >/dev/null 2>&1 && { echo "relanzado"; return 0; }
  echo "no se pudo relanzar"; return 1
}

# --- 1) Runs fallados de TODOS los workflows programados ---
for f in .github/workflows/*.yml; do
  wf=$(basename "$f")
  grep -q "schedule:" "$f" || continue
  [[ "$SKIP" == *" $wf "* ]] && continue
  run=$(gh run list --workflow "$wf" --status completed --limit 1 --json databaseId,conclusion,attempt,url \
        --jq '.[0] // {} | "\(.databaseId // "")|\(.conclusion // "none")|\(.attempt // 1)|\(.url // "")"' 2>/dev/null || echo "|none|1|")
  IFS='|' read -r id concl attempt url <<<"$run"
  echo "· $wf -> $concl"
  case "$concl" in failure|timed_out|startup_failure) ;; *) continue ;; esac

  log=$(gh run view "$id" --log-failed 2>/dev/null | tail -60 | cut -c1-300 || true)
  causa=$(causa_de "$log")
  extracto=$(grep -iE 'error|fail|exit code|timed out|unauthor|payment|sin saldo|"ok": ?false' <<<"$log" | tail -3 | sed 's/^/    /')
  case "$causa" in
    saldo|credencial)
      AGENTE="${AGENTE}- 🔴 **$wf** falló por **$causa** ([run]($url)). Reintentar no sirve: hay que cargar saldo / renovar la credencial.\n\`\`\`\n${extracto}\n\`\`\`\n" ;;
    *)
      if [[ "$PAGOS" == *" $wf "* && "$REANUDABLES" != *" $wf "* ]]; then
        AGENTE="${AGENTE}- 🔴 **$wf** (pago) falló por **$causa** ([run]($url)). No se relanza solo porque recompra todo: el agente debe corregir la causa y relanzar.\n\`\`\`\n${extracto}\n\`\`\`\n"
      elif [[ "$REANUDABLES" == *" $wf "* ]]; then
        acc=$(relanzar "$wf"); PROBLEMAS="${PROBLEMAS}- 🔁 **$wf** falló por **$causa** → $acc (reanuda: no recompra lo ya guardado).\n"
        [ "$causa" = timeout ] || [ "$causa" = desconocido ] && AGENTE="${AGENTE}- 🛠 **$wf**: causa **$causa** ([run]($url)); si vuelve a fallar hay que corregir el código.\n\`\`\`\n${extracto}\n\`\`\`\n"
      elif [ "${attempt:-1}" -lt 3 ]; then
        gh run rerun "$id" --failed >/dev/null 2>&1 && acc="reintentado (intento $((attempt + 1)))" || acc="no se pudo reintentar"
        PROBLEMAS="${PROBLEMAS}- 🔁 **$wf** falló por **$causa** → $acc.\n"
      else
        AGENTE="${AGENTE}- 🛠 **$wf** falló 3 veces seguidas por **$causa** ([run]($url)): necesita corregir la causa.\n\`\`\`\n${extracto}\n\`\`\`\n"
      fi ;;
  esac
done

# --- 2) Datos sin actualizar (incluye runs "verdes" que no trajeron datos) ---
HEALTH=$(curl -s --max-time 120 -H "Authorization: Bearer ${CRON_SECRET:-}" "$HEALTH_URL" || echo '{}')
if ! jq -e '.processes' >/dev/null 2>&1 <<<"$HEALTH"; then
  AGENTE="${AGENTE}- 🔴 El chequeo de frescura (/api/cron/health) no respondió: \`$(head -c 200 <<<"$HEALTH")\`.\n"
else
  while IFS='|' read -r proceso conexion wf ageH cadH estado; do
    [ -z "$proceso" ] && continue
    det="sin actualizar hace ${ageH} h (esperado cada ${cadH} h, $estado)"
    if [ -z "$wf" ] || [ "$wf" = "null" ]; then
      AGENTE="${AGENTE}- 🟠 **$proceso** ($conexion): $det. No tiene workflow: se carga por $conexion.\n"; continue
    fi
    last=$(gh run list --workflow "$wf" --status completed --limit 1 --json conclusion --jq '.[0].conclusion // "none"' 2>/dev/null || echo none)
    if [ "$last" = success ]; then
      acc=$(relanzar "$wf") || true
      AGENTE="${AGENTE}- 🛠 **$proceso**: $det, pero el último run de \`$wf\` terminó OK → corre sin traer datos ($acc). Revisar qué devuelve la fuente.\n"
    else
      PROBLEMAS="${PROBLEMAS}- 🟠 **$proceso**: $det (último run \`$last\`, ver arriba).\n"
    fi
  done < <(jq -r '(.desvios // [])[] | [.proceso, .conexion, (.workflow // ""), (.ageH|tostring), (.cadenciaH|tostring), .estado] | map(gsub("\\|"; "/")) | join("|")' <<<"$HEALTH")
fi

# --- 3) Issue (se cierra solo al recuperarse) ---
TITLE="🔴 Watchdog: procesos de datos con desvío"
EXIST=$(gh issue list --state open --search "$TITLE in:title" --json number --jq '.[0].number // ""' 2>/dev/null || echo "")
NOW=$(date -u '+%Y-%m-%d %H:%M UTC')
if [ -n "$PROBLEMAS$AGENTE" ]; then
  BODY=$(printf "Watchdog %s.\n\n" "$NOW")
  [ -n "$AGENTE" ] && BODY+=$(printf "### Necesita corrección (agente de monitoreo)\n%b\n" "$AGENTE")
  [ -n "$PROBLEMAS" ] && BODY+=$(printf "\n### Corregido automáticamente\n%b" "$PROBLEMAS")
  gh label create watchdog-agente --color B60205 --description "El agente de monitoreo debe corregirlo" >/dev/null 2>&1 || true
  if [ -n "$EXIST" ]; then gh issue comment "$EXIST" --body "$BODY"
  else gh issue create --title "$TITLE" --body "$BODY" --label watchdog-agente >/dev/null 2>&1 || gh issue create --title "$TITLE" --body "$BODY" || true; fi
  [ -n "$AGENTE" ] && [ -n "$EXIST" ] && gh issue edit "$EXIST" --add-label watchdog-agente >/dev/null 2>&1 || true
  echo "::warning::Watchdog encontró desvíos"
elif [ -n "$EXIST" ]; then
  gh issue comment "$EXIST" --body "✅ Todo recuperado ($NOW). Cerrando alerta."
  gh issue close "$EXIST"
fi
printf "%b%b" "$AGENTE" "$PROBLEMAS"
