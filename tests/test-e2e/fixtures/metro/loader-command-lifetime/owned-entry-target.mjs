import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const [mode, witness, ...args] = process.argv.slice(2);
process.stdout.write(JSON.stringify({ args, cwd: process.cwd(), context: process.env.TTSC_E2E_CARRIER_CONTEXT }) + "\n");
process.stderr.write("AUTHORED_CARRIER_STDERR\n");
if (mode === "nonzero") process.exitCode = 9;
if (mode === "cancel") {
  const descendant = spawn(process.execPath, ["--input-type=module", "-e", "import fs from 'node:fs'; fs.writeFileSync(process.argv[1], 'descendant-ready'); setInterval(() => {}, 1000)", path.join(witness, "descendant")], { stdio: "ignore" });
  descendant.once("error", (error) => { throw error; });
  fs.writeFileSync(path.join(witness, "parent"), "parent-ready");
  setInterval(() => {}, 1000);
}
