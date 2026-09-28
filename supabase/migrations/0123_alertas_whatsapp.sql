-- Alertas por WhatsApp (Evolution API self-host en Railway, docs/whatsapp-evolution-railway.md).
--   · alert_prefs.whatsapp_on / whatsapp_destinatarios → canal WhatsApp configurable en /alerts
--     (números normalizados 549XXXXXXXXXX, sin "+").
--   · alert_log.estado → latido del canal 'whatsapp' (enviado / desconectado / sin_config /
--     sin_destinatarios / error) que muestran /alerts y /monitoreo.
-- Aditiva e idempotente. Sin ella: el email sigue igual, WhatsApp queda apagado y la UI lo avisa.

alter table alert_prefs add column if not exists whatsapp_on boolean not null default false;
alter table alert_prefs add column if not exists whatsapp_destinatarios text[] not null default '{}';
alter table alert_log add column if not exists estado text;

-- Que PostgREST vea las columnas nuevas sin esperar al refresco automático.
notify pgrst, 'reload schema';
