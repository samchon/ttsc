import fs from "node:fs";
import { isMainThread, threadId } from "node:worker_threads";

if (!isMainThread) {
  fs.appendFileSync(
    process.env.TTSC_WORKER_PRELOAD_LOG,
    JSON.stringify({ threadId, execArgv: process.execArgv }) + "\n",
  );
}
