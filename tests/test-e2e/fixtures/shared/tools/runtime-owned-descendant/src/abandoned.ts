declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const nonce = process.env.TTSC_E2E_ABANDONED_NONCE;
if (!nonce) throw new Error("missing abandoned generation nonce");
const controller = require("node:net").connect(Number(process.env.TTSC_E2E_OWNER_PORT), "127.0.0.1");
controller.on("error", () => process.exit(1));
controller.on("end", () => process.exit(1));
controller.on("connect", () => controller.write(JSON.stringify({ role: "sibling", nonce: process.env.TTSC_E2E_OWNER_NONCE, pid: process.pid }) + "\n"));
const announcement = path.join(root, "abandoned-" + nonce);
fs.writeFileSync(announcement + ".tmp", JSON.stringify({
  nonce, pid: process.pid, run: process.env.TTSX_RUNTIME_RUN_DIR,
}));
fs.renameSync(announcement + ".tmp", announcement + ".json");
setInterval(() => {
  if (fs.existsSync(path.join(root, "release-" + nonce))) process.exit(0);
}, 25);
export {};
