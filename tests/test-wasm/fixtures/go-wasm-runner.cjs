const fs = require("node:fs");

if (process.argv[2] === "throw") throw new Error("authored runner failure");
fs.writeSync(1, JSON.stringify({
  pid: process.pid,
  cwd: process.cwd(),
  argv: process.argv.slice(1),
  execArgv: process.execArgv,
  env: { ...process.env },
}) + "\n");
fs.writeSync(2, "authored runner stderr\n");
if (process.argv[2] === "hold") {
  const gate = process.argv[3];
  setInterval(() => {
    if (fs.existsSync(gate)) process.exit(0);
  }, 20);
} else process.exit(Number(process.argv[3] ?? 0));
