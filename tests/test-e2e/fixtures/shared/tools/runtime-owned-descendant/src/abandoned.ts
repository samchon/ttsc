declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const nonce = process.env.TTSC_E2E_ABANDONED_NONCE;
if (!nonce) throw new Error("missing abandoned generation nonce");
const ready = { pid: process.pid, run: process.env.TTSX_RUNTIME_RUN_DIR, abandonedNonce: nonce };
require("../../runtime-owned-descendant.cjs").connect("sibling", ready, () => {
  const announcement = path.join(root, "abandoned-" + nonce);
  fs.writeFileSync(announcement + ".tmp", JSON.stringify(ready));
  fs.renameSync(announcement + ".tmp", announcement + ".json");
}, () => { throw new Error("abandoned sibling must receive self-SIGKILL, never normal release"); });
export {};
