const { isMainThread, workerData } = require("node:worker_threads");

// Exercise actual owner-thread failure before it can acquire a native child.
if (!isMainThread) {
  if (workerData.args.at(-1) === "error") throw new Error("authored resident owner startup error");
  process.exit(7);
}
