// Observe real OS process identities. This actor launches no product command.
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const stopFile = process.argv[2];
const inputsFile = path.join(path.dirname(stopFile), "observer-inputs.json");
const requestFile = path.join(path.dirname(stopFile), "observer-request.json");
let stopping = false;
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
process.stdin.resume();
process.stdin.once("end", () => { stopping = true; fs.writeFileSync(stopFile, "stop"); });

// One persistent CIM reader avoids starting PowerShell for every scan. Node
// owns all pathname observations, including Windows paths beyond MAX_PATH.
let windows;
if (process.platform === "win32") {
  const command = "$ErrorActionPreference='Stop'; while ($null -ne [Console]::ReadLine()) { $rows=@(Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;identity=$_.CreationDate.ToUniversalTime().ToString('o');command=$_.CommandLine;name=$_.Name} }); [Console]::WriteLine((ConvertTo-Json -InputObject $rows -Depth 4 -Compress)) }";
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`CIM observer exited ${code}: ${stderr}`)));
  });
  void closed.catch(() => {});
  const lines = readline.createInterface({ input: child.stdout });
  let pending;
  let failure;
  const fail = (error) => { failure ??= error; pending?.reject(error); pending = undefined; };
  child.once("error", fail);
  child.stdin.on("error", fail);
  child.once("close", () => fail(new Error("CIM observer closed before its requested scan")));
  lines.on("line", (line) => {
    const request = pending;
    pending = undefined;
    if (!request) return fail(new Error("CIM observer returned an unsolicited snapshot"));
    try {
      const rows = JSON.parse(line);
      if (!Array.isArray(rows)) throw new Error("CIM observer returned a non-array process snapshot");
      request.resolve(rows);
    } catch (error) { request.reject(error); fail(error); }
  });
  windows = {
    query() {
      if (failure) return Promise.reject(failure);
      if (pending) return Promise.reject(new Error("CIM observer already has a requested scan"));
      return new Promise((resolve, reject) => {
        pending = { resolve, reject };
        child.stdin.write("scan\n");
      });
    },
    async close() { child.stdin.end(); await closed; },
  };
}
async function scan() {
  try {
    while (!stopping) {
      const request = fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")).request : null;
      // Path readings precede the requested process query. These snapshots do
      // not replace the public owner's original native retirement certificate.
      const inputs = fs.existsSync(inputsFile) ? JSON.parse(fs.readFileSync(inputsFile, "utf8")).map((input) => ({ path: input, exists: fs.existsSync(input) })) : [];
      let rows;
      if (windows) rows = await windows.query();
      else {
        // lstart has second precision and uses localtime on both supported ps
        // implementations. UTC prevents local DST folds from reversing dates;
        // equal seconds remain ambiguous and never certify original lifetime.
        const stdout = await new Promise((resolve, reject) => execFile("ps", ["-axo", "pid=,ppid=,lstart=,comm=,args="], { maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LC_ALL: "C", TZ: "UTC" } }, (error, output) => error ? reject(error) : resolve(output)));
        rows = String(stdout).split("\n").filter(Boolean).map((line) => {
          const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(\S+)\s+(.*)$/);
          if (!match) throw new Error("Unrecognized ps process identity: " + line);
          return { pid: Number(match[1]), parent: Number(match[2]), identity: match[3], name: match[4], command: match[5] };
        });
      }
      send({ kind: "scan", request, rows, inputs });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } finally {
    if (windows) await windows.close();
  }
}
scan().then(() => { send({ kind: "scanner-closed", code: 0 }); }).catch((error) => { send({ kind: "scanner-closed", code: 1 }); console.error(error); process.exitCode = 1; process.stdin.destroy(); });
