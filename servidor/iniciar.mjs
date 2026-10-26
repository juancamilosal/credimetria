// `npm start`: la API de tasas (dev-api.mjs) y el servidor de Angular juntos.
import { spawn } from "node:child_process";

// Node se lanza directo (sin consola): su ruta puede tener espacios, como
// "C:\Program Files\nodejs\node.exe" en Windows.
const api = spawn(process.execPath, ["servidor/dev-api.mjs"], {
  stdio: "inherit",
});
// `ng` sí necesita la consola en Windows (npx.cmd); va como un solo comando.
const ng = spawn(["npx", "ng", "serve", ...process.argv.slice(2)].join(" "), {
  stdio: "inherit",
  shell: true,
});

for (const hijo of [api, ng]) {
  hijo.on("exit", (codigo) => {
    api.kill();
    ng.kill();
    process.exit(codigo ?? 0);
  });
}
