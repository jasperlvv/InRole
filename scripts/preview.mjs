import { spawn } from "node:child_process";
import { loadEnvironment } from "./db/common.mjs";
loadEnvironment();
const port = Number(process.env.PREVIEW_PORT || 3100);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid preview port");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { windowsHide: true, stdio: "inherit", env: { ...process.env, APP_ORIGIN: `http://localhost:${port}` } });
child.on("exit", code => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
