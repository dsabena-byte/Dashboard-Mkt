// Test puro de los helpers de auth (redirect seguro, tipos OTP, validación de contraseña).
// Correr: cd apps/web && npx tsx scripts/auth-safe-next.test.ts
import { asOtpType, safeNext, validateNewPassword } from "../src/lib/auth/safe-next";

let fails = 0;
function eq(name: string, got: unknown, want: unknown) {
  if (got !== want) {
    fails++;
    console.error(`FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
  }
}

eq("relativo", safeNext("/login/nueva-clave"), "/login/nueva-clave");
eq("con query", safeNext("/web?tab=x"), "/web?tab=x");
eq("null", safeNext(null), "/");
eq("vacío", safeNext(""), "/");
eq("absoluta", safeNext("https://evil.com"), "/");
eq("protocol-relative", safeNext("//evil.com"), "/");
eq("backslash", safeNext("/\\evil.com"), "/");
eq("backslash medio", safeNext("/a\\b"), "/");
eq("tab", safeNext("/\t/evil.com"), "/");
eq("sin barra", safeNext("evil.com"), "/");
eq("javascript", safeNext("javascript:alert(1)"), "/");
eq("fallback", safeNext("//x", "/login/nueva-clave"), "/login/nueva-clave");

eq("otp recovery", asOtpType("recovery"), "recovery");
eq("otp invite", asOtpType("invite"), "invite");
eq("otp inválido", asOtpType("admin"), null);
eq("otp null", asOtpType(null), null);

eq("pwd corta", validateNewPassword("123456789", "123456789") !== null, true);
eq("pwd no coincide", validateNewPassword("1234567890", "1234567891") !== null, true);
eq("pwd ok", validateNewPassword("1234567890", "1234567890"), null);

if (fails) {
  console.error(`${fails} fallas`);
  process.exit(1);
}
console.log("auth-safe-next: OK");
