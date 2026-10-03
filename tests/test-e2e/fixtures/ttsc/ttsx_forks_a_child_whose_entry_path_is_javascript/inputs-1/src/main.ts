const { fork } = require("node:child_process");
const child = fork(__dirname + "/child.js", { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
