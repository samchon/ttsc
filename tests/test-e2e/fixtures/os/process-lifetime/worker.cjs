const fs = require("node:fs");
const { spawn } = require("node:child_process");
const path = require("node:path");

// The two real adapters use different readiness channels. Neither mode answers
// a compiler request: these children exercise only EOF and kernel pipe lifetime.
const [adapter, mode, ready, childPid, ended, hold] = process.argv.slice(2);
if (adapter === "graph") {
  if (mode === "inherited-stdio") {
    const child = spawn(process.execPath, [path.join(__dirname, "pipe-holder.cjs"), "graph", ready], {
      stdio: ["ignore", 1, 2], detached: true, windowsHide: true,
    });
    child.unref();
    process.stdout.write("ready\n", () => process.exit(0));
  } else {
    console.log("ready");
    if (mode === "already-exited") process.exit(0);
    if (mode !== "unread") process.stdin.resume();
    if (mode === "forced" || mode === "unread") setInterval(() => {}, 1000);
    else process.stdin.on("end", () => process.exit(mode === "nonzero" ? 2 : 0));
  }
} else if (adapter === "resident") {
  if (mode === "pipe") {
    spawn(process.execPath, [path.join(__dirname, "pipe-holder.cjs"), "resident", childPid, ended, hold], {
      stdio: ["ignore", 1, 2], windowsHide: true, detached: true,
    });
  }
  if (mode !== "unread") process.stdin.resume();
  if (mode === "ignore" || mode === "unread") setInterval(() => {}, 1000);
  else process.stdin.on("end", () => {
    if (mode === "pipe") fs.writeFileSync(ended, "EOF");
    process.exit(mode === "pipe" ? 0 : Number(hold));
  });
  fs.writeFileSync(ready, String(process.pid) + "\n");
} else throw new Error(`Unknown authored process adapter: ${adapter}`);
