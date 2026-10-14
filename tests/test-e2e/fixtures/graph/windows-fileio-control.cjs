// An independently owned file control, never a compiler input or EPERM reproduction.
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

async function main() {
  const { ColdGraphActorLifecycle } = await import(pathToFileURL(path.resolve(__dirname, "../../../utils/src/ColdGraphActorLifecycle.ts")).href);
  const file = process.argv[2];
  const report = process.argv[3];
  let descriptor;
  let stopping = false;
  let queue = Promise.resolve();
  const record = async (event, data = {}) => {
    const row = { event, pid: process.pid, file, at: new Date().toISOString(), ...data };
    fs.appendFileSync(report, JSON.stringify(row) + "\n");
    await ColdGraphActorLifecycle.send(process, row);
  };
  const close = () => {
    if (stopping) return;
    stopping = true;
    void queue.finally(async () => {
      try { if (descriptor !== undefined) { fs.closeSync(descriptor); descriptor = undefined; await record("closed"); } }
      catch (error) { process.exitCode = 1; process.stderr.write(String(error) + "\n"); }
      finally { process.removeListener("message", message); if (process.connected) process.disconnect(); }
    }).catch((error) => { process.exitCode = 1; process.stderr.write(String(error) + "\n"); });
  };
  const message = (command) => {
    if (command === "finish") { close(); return; }
    if (stopping) return;
    queue = queue.then(async () => {
      if (command === "create") { fs.writeFileSync(file, "owned control\n", { flag: "wx" }); await record("created"); }
      else if (command === "open") { descriptor = fs.openSync(file, "r"); await record("opened", { size: fs.fstatSync(descriptor).size }); }
      else if (command === "hold") { if (descriptor === undefined) throw new Error("Control has no original open descriptor"); await record("held", { size: fs.fstatSync(descriptor).size }); }
      else if (command === "close") { fs.closeSync(descriptor); descriptor = undefined; await record("closed"); }
      else if (command === "unlink") { fs.unlinkSync(file); await record("unlinked"); }
      else throw new Error("Unknown file control command");
    }).catch(async (error) => {
      process.exitCode = 1;
      process.stderr.write(String(error) + "\n");
      try { await record("failed", { diagnostic: String(error), code: error.code, syscall: error.syscall, path: error.path }); }
      finally { close(); }
    });
  };
  process.on("message", message);
  process.once("disconnect", close);
  const identity = JSON.parse(execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; $p=Get-CimInstance Win32_Process -Filter 'ProcessId=${process.pid}'; if ($null -eq $p) { throw 'Owned control process was not observed' }; [pscustomobject]@{pid=[int]$p.ProcessId;birth=$p.CreationDate.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress`], { windowsHide: true, encoding: "utf8" }));
  await record("ready", identity);
}

main().catch((error) => { console.error(error); process.exitCode = 1; if (process.connected) process.disconnect(); });
