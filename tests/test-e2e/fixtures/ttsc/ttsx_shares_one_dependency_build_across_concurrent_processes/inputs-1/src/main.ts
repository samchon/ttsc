const { spawn } = require("node:child_process");
const run = (): Promise<number> =>
  new Promise<number>((resolve) => {
    const child = spawn(
      process.execPath,
      [__dirname + "/worker.ts"],
      { stdio: "inherit" },
    );
    child.on("exit", (code) => resolve(code ?? 1));
  });
void Promise.all([run(), run(), run()]).then((codes) => {
  process.exit(codes.every((code) => code === 0) ? 0 : 1);
});
