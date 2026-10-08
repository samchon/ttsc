const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
// The authenticated controller socket outlives the intentionally exited parent.
// EOF proves the controller connection ended without relying on a reusable PID.
const controller = net.connect(Number(process.env.TTSC_E2E_OWNER_PORT), "127.0.0.1");
controller.on("error", () => process.exit(1));
let released = false;
controller.on("end", () => { if (!released) process.exit(1); });
controller.on("connect", () => {
  const ready = { pid: process.pid, manifest: process.env.TTSX_RUNTIME_MANIFEST, run: process.env.TTSX_RUNTIME_RUN_DIR, runtime: process.env.TTSX_RUNTIME_CACHE_DIR, runs: process.env.TTSX_RUNTIME_RUNS_DIR };
  controller.write(JSON.stringify({ ...ready, role: "descendant", nonce: process.env.TTSC_E2E_OWNER_NONCE }) + "\n");
  fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify(ready));
  fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
});
const release = setInterval(() => {
  if (!fs.existsSync(path.join(__dirname, "release"))) return;
  clearInterval(release);
  fs.writeFileSync(path.join(__dirname, "result"), require("./src/lazy.cts").value);
  released = true;
  controller.end();
}, 25);
