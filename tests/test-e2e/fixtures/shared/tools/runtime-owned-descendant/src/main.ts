declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const child = require("node:child_process").spawn(process.execPath, [path.join(root, "worker.cjs")], { cwd: root, detached: true, stdio: "ignore", windowsHide: true });
child.unref();
const deadline = Date.now() + 30000;
while (!fs.existsSync(path.join(root, "ready.json"))) {
  if (Date.now() > deadline) throw new Error("owned descendant did not acknowledge its inherited generation");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
console.log(JSON.stringify({ parent: process.pid, child: child.pid }));
export {};
