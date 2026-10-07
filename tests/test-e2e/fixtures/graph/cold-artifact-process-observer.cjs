// Observe real OS process identities. This actor launches no product command.
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const stopFile = process.argv[2];
const inputsFile = path.join(path.dirname(stopFile), "observer-inputs.json");
const requestFile = path.join(path.dirname(stopFile), "observer-request.json");
let stopping = false;
const send = (value) => process.stdout.write(JSON.stringify(value) + "\n");
process.stdin.resume();
process.stdin.once("end", () => { stopping = true; fs.writeFileSync(stopFile, "stop"); });
if (process.platform === "win32") {
  // Sample the request before starting the OS query. A delivered older scan
  // cannot acknowledge a request published after that query started.
  const command = "$ErrorActionPreference='Stop'; while (!(Test-Path -LiteralPath $env:TTSC_PROCESS_OBSERVER_STOP)) { $request=$null; if (Test-Path -LiteralPath $env:TTSC_PROCESS_OBSERVER_REQUEST) { $request=(ConvertFrom-Json -InputObject (Get-Content -Raw -LiteralPath $env:TTSC_PROCESS_OBSERVER_REQUEST)).request }; $inputs=@(); if (Test-Path -LiteralPath $env:TTSC_PROCESS_OBSERVER_INPUTS) { $paths=ConvertFrom-Json -InputObject (Get-Content -Raw -LiteralPath $env:TTSC_PROCESS_OBSERVER_INPUTS); $inputs=@(foreach ($inputPath in $paths) { [pscustomobject]@{path=[string]$inputPath;exists=(Test-Path -LiteralPath $inputPath)} }) }; $rows=@(Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;identity=$_.CreationDate.ToUniversalTime().ToString('o');command=$_.CommandLine;name=$_.Name} }); [Console]::WriteLine((ConvertTo-Json -InputObject @{kind='scan';request=$request;rows=$rows;inputs=$inputs} -Depth 4 -Compress)); Start-Sleep -Milliseconds 50 }";
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
    env: { ...process.env, TTSC_PROCESS_OBSERVER_STOP: stopFile, TTSC_PROCESS_OBSERVER_INPUTS: inputsFile, TTSC_PROCESS_OBSERVER_REQUEST: requestFile },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.once("error", (error) => { console.error(error); process.exitCode = 1; });
  child.once("close", (code) => { send({ kind: "scanner-closed", code }); process.exitCode = code ?? 1; process.stdin.destroy(); });
} else {
  async function scan() {
    while (!stopping) {
      const request = fs.existsSync(requestFile) ? JSON.parse(fs.readFileSync(requestFile, "utf8")).request : null;
      // Inputs precede the process snapshot: absent input followed by a live
      // original owner is a real ordering violation, not a stale PID reading.
      const inputs = fs.existsSync(inputsFile) ? JSON.parse(fs.readFileSync(inputsFile, "utf8")).map((input) => ({ path: input, exists: fs.existsSync(input) })) : [];
      const stdout = await new Promise((resolve, reject) => execFile("ps", ["-axo", "pid=,ppid=,lstart=,comm=,args="], { maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LC_ALL: "C" } }, (error, output) => error ? reject(error) : resolve(output)));
      const rows = String(stdout).split("\n").filter(Boolean).map((line) => {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(\S+)\s+(.*)$/);
        if (!match) throw new Error("Unrecognized ps process identity: " + line);
        return { pid: Number(match[1]), parent: Number(match[2]), identity: match[3], name: match[4], command: match[5] };
      });
      send({ kind: "scan", request, rows, inputs });
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  scan().then(() => { send({ kind: "scanner-closed", code: 0 }); }).catch((error) => { send({ kind: "scanner-closed", code: 1 }); console.error(error); process.exitCode = 1; process.stdin.destroy(); });
}
