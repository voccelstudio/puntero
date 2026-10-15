// Credenciales del DUEÑO para los smokes que ESCRIBEN en el registro de cuentas.
//
// El repo es público y el hosting sirve archivos, así que jamás van en el
// código: se leen de una variable de entorno o de tests/.secret.json (que está
// en .gitignore y además firebase.json no publica tests/).
//
// Si faltan, los smokes lo dicen y salen con error en lugar de fingir que
// sincronizaron: un push sin sesión no escribe nada (por diseño).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));

export function credencialesDueno() {
  const email = process.env.PUNTERO_MASTER_EMAIL;
  const pass = process.env.PUNTERO_MASTER_PASS;
  if (email && pass) { return { email, pass }; }
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, "..", ".secret.json"), "utf8"));
    if (j && j.email && j.pass) { return { email: String(j.email), pass: String(j.pass) }; }
  } catch (e) { /* no existe o ilegible: se reporta con FALTA_CREDENCIAL */ }
  return null;
}

export const FALTA_CREDENCIAL =
  "FALTAN credenciales del dueño: creá tests/.secret.json " +
  'con {"email":"...","pass":"..."} (no se commitea) o exportá ' +
  "PUNTERO_MASTER_EMAIL / PUNTERO_MASTER_PASS antes de correr el smoke.";
