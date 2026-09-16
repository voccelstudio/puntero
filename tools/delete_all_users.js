// Borra TODOS los usuarios de Firebase Auth del proyecto.
// Uso:
//   1) npm install (o npm i -D firebase-admin) en la raíz del proyecto
//   2) Descargá la clave del proyecto: Consola Firebase → ⚙️ Config. del
//      proyecto → Cuentas de servicio → "Generar nueva clave privada"
//   3) Ejecutá:
//        node tools/delete_all_users.js --key=C:\ruta\a\tu-clave.json --dry-run
//        node tools/delete_all_users.js --key=C:\ruta\a\tu-clave.json --yes
//   El flag --dry-run lista cuántos usuarios hay SIN borrar nada.
//   Solo con --yes se eliminan definitivamente (no se pueden recuperar).
//   NOTA: las cuentas maestras y demo (invitado01 / invitado clara) son
//   locales y NO están en Firebase, así que no se tocan.
const admin = require("firebase-admin");
const fs = require("fs");

const args = process.argv.slice(2);
const keyIdx = args.indexOf("--key");
const dryRun = args.includes("--dry-run") || !args.includes("--yes");

if (keyIdx === -1 || !args[keyIdx + 1]) {
  console.error("Falta --key=/ruta/clave.json");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(args[keyIdx + 1], "utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();

(async () => {
  let all = [];
  let next = null;
  do {
    const res = await auth.listUsers(1000, next);
    all = all.concat(res.users);
    next = res.pageToken || null;
  } while (next);

  console.log("Total de usuarios en Firebase Auth:", all.length);
  all.forEach((u) => console.log("  -", u.email || u.uid, "|", u.disabled ? "DESHABILITADO" : "activo", "| creado:", u.metadata.creationTime));

  if (all.length === 0) {
    console.log("No hay nada que borrar. Fin.");
    process.exit(0);
  }
  if (dryRun) {
    console.log("DRY-RUN: no se borró nada. Ejecuta con --yes para borrar definitivamente.");
    process.exit(0);
  }

  // Confirmación extra
  if (!process.env.FB_DELETE_CONFIRM) {
    console.warn("\nATENCIÓN: esto BORRA definitivamente todos los usuarios de arriba.");
    console.warn("Para continuar, ejecutá el comando con la variable de entorno:\n  $env:FB_DELETE_CONFIRM=1 (PowerShell)");
    process.exit(1);
  }

  // Borrar en lotes de hasta 1000
  let deleted = 0;
  for (let i = 0; i < all.length; i += 1000) {
    const batch = all.slice(i, i + 1000);
    await auth.deleteUsers(batch.map((u) => u.uid));
    deleted += batch.length;
    console.log("Borrados:", deleted, "/", all.length);
  }
  console.log("Listo. Se borraron", deleted, "usuarios. Quedan solo los locales (maestra y demos).");
  process.exit(0);
})().catch((e) => { console.error("Error:", e.message); process.exit(1); });