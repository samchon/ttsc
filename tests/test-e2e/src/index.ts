import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";
import { BatchWorkspace } from "./batch/BatchWorkspace";

// Immutable consumers finish before the editor changes source bytes. Each file
// owns its explicit DAG consumers; webpack includes two real hosts. No legacy scenario discovery remains.
const batches = [
  "runtime",
  "vite",
  "esbuild",
  "webpack",
  "bun",
  "metro",
  "evidence",
  "graph",
  "lsp",
] as const;
if (process.argv.some((argument) => argument.startsWith("--package=")))
  throw new Error("The shared DAG suite runs the shared boundary DAG together");
await TestExecutor.main({
  location: (process.argv.includes("--installation")
    ? (["runtime"] as const)
    : batches
  ).map((name) =>
    path.join(import.meta.dirname, "features", `test_e2e_${name}_batch.ts`),
  ),
});
if (!process.exitCode) await BatchWorkspace.close();
