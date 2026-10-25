// `npm start`: la API de tasas (dev-api.mjs) y el servidor de Angular juntos.
import { spawn } from "node:child_process";

const correr = (comando, args) =>
  spawn(comando, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

const api = correr(process.execPath, ["servidor/dev-api.mjs"]);
const ng = correr("npx", ["ng", "serve", ...process.argv.slice(2)]);
for (const hijo of [api, ng]) {
  hijo.on("exit", (codigo) => {
    api.kill();
    ng.kill();
    process.exit(codigo ?? 0);
  });
}
