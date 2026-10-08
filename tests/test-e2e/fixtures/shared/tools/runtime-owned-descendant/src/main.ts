declare const require: any;
declare const process: any;
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const root = path.dirname(__dirname);
const child = require("node:child_process").spawn(process.execPath, [path.join(root, "worker.cjs")], { cwd: root, detached: true, stdio: "ignore", windowsHide: true });
child.unref();
child.once("error", (error: Error) => { throw error; });
child.once("exit", () => {
  if (!fs.existsSync(path.join(root, "ready.json"))) {
    clearInterval(ready);
    process.exitCode = 1;
  }
});
const ready = setInterval(() => {
  if (!fs.existsSync(path.join(root, "ready.json"))) return;
  clearInterval(ready);
  console.log(JSON.stringify({ parent: process.pid, child: child.pid }));
}, 25);
export {};
