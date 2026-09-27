// Links de solo lectura + envío programado de Mis tableros (portado de BIP, sep-2026).
// Correr: cd apps/web && npx tsx scripts/tablero-share.test.ts
import { signShare, verifyShare, isActive, sanitizeState, isEnvioDue, clampDias, cleanDest, newNonce, splitByDomain, SHARE_SLUG } from "../src/lib/tablero-share";

let fails = 0, passes = 0;
const ok = (name: string, cond: boolean, extra?: unknown) => { if (cond) passes++; else { fails++; console.error(`✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)); } };

const secret = "s3cr3t";
const now = Date.parse("2026-09-28T12:00:00Z");
const exp = Math.floor(now / 1000) + 86400;
const p = { s: "t-ventas-ab12", e: exp, n: newNonce() };
const tok = signShare(p, secret);
ok("token url-safe", /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(tok), tok);
ok("verifica", JSON.stringify(verifyShare(tok, secret, now)) === JSON.stringify(p));
ok("otro secreto → null", verifyShare(tok, "otro", now) === null);
ok("vencido → null", verifyShare(tok, secret, (exp + 1) * 1000) === null);
const [body, mac] = tok.split(".") as [string, string];
const forged = Buffer.from(JSON.stringify({ ...p, s: "t-otro-zz99" })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
ok("payload alterado → null", verifyShare(`${forged}.${mac}`, secret, now) === null);
ok("mac alterado → null", verifyShare(`${body}.${mac.slice(0, -2)}xx`, secret, now) === null);
ok("basura → null", verifyShare("a.b.c", secret, now) === null && verifyShare("", secret, now) === null && verifyShare(tok, "", now) === null);
ok("slug inválido firmado → null", verifyShare(signShare({ ...p, s: "../x" }, secret), secret, now) === null);

const st = sanitizeState({ links: { [p.s]: { nonce: p.n, exp, creado: "x" }, "MAL SLUG": { nonce: "a", exp } }, envios: { [p.s]: { frecuencia: "semanal", destinatarios: "ana@empresa.com, no-es-mail, ANA@empresa.com" }, x1: { frecuencia: "diaria", destinatarios: ["a@b.co"] } } });
ok("sanitize descarta slugs inválidos", Object.keys(st.links).length === 1);
ok("sanitize limpia emails (dedupe, minúsculas)", st.envios[p.s]?.destinatarios.join() === "ana@empresa.com", st.envios);
ok("sanitize descarta frecuencia inválida", !st.envios.x1);
ok("activo", isActive(st, p, now));
ok("revocado (nonce distinto) → inactivo", !isActive(st, { ...p, n: "otro" }, now));
ok("sin link → inactivo", !isActive(sanitizeState(null), p, now));

// Dominios permitidos
const sd = splitByDomain(["a@mabe.com.ar", "b@gmail.com", "c@MABE.com.ar".toLowerCase()], ["mabe.com.ar", "@drean.com.ar"]);
ok("dominios: solo los del equipo", sd.ok.join() === "a@mabe.com.ar,c@mabe.com.ar" && sd.rejected.join() === "b@gmail.com", sd);
ok("dominios: sin lista → todos rechazados", splitByDomain(["a@x.com"], []).ok.length === 0);

// Envío programado (hora AR = UTC−3)
const lunesAR = new Date("2026-09-28T11:00:00Z"); // lunes 08:00 AR
const martesAR = new Date("2026-09-29T11:00:00Z");
ok("semanal: lunes sin envío previo → toca", isEnvioDue({ frecuencia: "semanal", destinatarios: ["a@b.co"] }, lunesAR));
ok("semanal: martes → no", !isEnvioDue({ frecuencia: "semanal", destinatarios: ["a@b.co"] }, martesAR));
ok("semanal: ya enviado hoy → no", !isEnvioDue({ frecuencia: "semanal", destinatarios: ["a@b.co"], ultimo: "2026-09-28T11:05:00Z" }, new Date("2026-09-28T13:00:00Z")));
ok("semanal: último hace 7 días → toca", isEnvioDue({ frecuencia: "semanal", destinatarios: ["a@b.co"], ultimo: "2026-09-21T11:00:00Z" }, lunesAR));
ok("semanal: usa hora AR (domingo noche) → no", !isEnvioDue({ frecuencia: "semanal", destinatarios: ["a@b.co"] }, new Date("2026-09-28T02:30:00Z")));
const dia1 = new Date("2026-10-01T11:00:00Z");
ok("mensual: día 1 sin envío → toca", isEnvioDue({ frecuencia: "mensual", destinatarios: ["a@b.co"] }, dia1));
ok("mensual: mitad de mes → no", !isEnvioDue({ frecuencia: "mensual", destinatarios: ["a@b.co"] }, martesAR));
ok("mensual: ya enviado este mes → no", !isEnvioDue({ frecuencia: "mensual", destinatarios: ["a@b.co"], ultimo: "2026-10-01T11:00:00Z" }, new Date("2026-10-02T11:00:00Z")));
ok("mensual: enviado el mes pasado → toca", isEnvioDue({ frecuencia: "mensual", destinatarios: ["a@b.co"], ultimo: "2026-08-01T11:00:00Z" }, new Date("2026-10-01T11:00:00Z")));

ok("clampDias", clampDias(7) === 7 && clampDias(90) === 90 && clampDias(365) === 30 && clampDias("x") === 30);
ok("cleanDest tope 10", cleanDest(Array.from({ length: 15 }, (_, i) => `u${i}@x.com`)).length === 10);
ok("slug reservado (fila de config en `tableros`)", SHARE_SLUG === "cfg-compartir");

console.log(`tablero-share: ${passes} OK, ${fails} fallas`);
if (fails) process.exit(1);
