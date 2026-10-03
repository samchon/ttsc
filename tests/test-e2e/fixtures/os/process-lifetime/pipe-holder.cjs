const fs = require("node:fs");
const [adapter, identity, ended, hold] = process.argv.slice(2);
if (adapter === "graph") console.log(process.execPath, process.pid);
else if (adapter === "resident") fs.writeFileSync(identity, String(process.pid) + "\n");
else throw new Error(`Unknown authored pipe adapter: ${adapter}`);
const timer = setInterval(() => {
  if (adapter === "graph" ? !fs.existsSync(identity) : fs.existsSync(ended)) {
    clearInterval(timer);
    setTimeout(() => process.exit(0), adapter === "graph" ? 0 : Number(hold));
  }
}, 10);
