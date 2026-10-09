import path from "node:path";

import { OwnedE2eEntry } from "./batch/OwnedE2eEntry";

const controller = new AbortController();
const cancel = () => controller.abort(new Error("E2E entry interrupted"));
process.once("SIGINT", cancel);
process.once("SIGTERM", cancel);
try {
  const result = await OwnedE2eEntry.run({
    entry: path.join(import.meta.dirname, "main.ts"),
    args: process.argv.slice(2),
    signal: controller.signal,
  });
  if (result.error) throw result.error;
  if (result.status === null)
    throw new Error(`E2E entry terminated with signal ${result.signal}`);
  process.exitCode = result.status;
} finally {
  process.removeListener("SIGINT", cancel);
  process.removeListener("SIGTERM", cancel);
}
