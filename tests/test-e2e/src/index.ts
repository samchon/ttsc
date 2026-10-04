import path from "node:path";
import { TestExecutor } from "../../utils/src/TestExecutor";
import { BatchWorkspace } from "./batch/BatchWorkspace";

// Immutable consumers finish before the editor changes source bytes. Each file
// owns one actual product session; no legacy scenario discovery remains.
const batches = [
  "runtime", "vite", "esbuild", "webpack", "rspack", "bun", "metro", "graph", "lsp",
] as const;
if (process.argv.some((argument) => argument.startsWith("--package=")))
  throw new Error("The shared DAG suite runs all nine boundary sessions together");
await TestExecutor.main({
  location: (process.argv.includes("--installation") ? ["runtime"] as const : batches).map((name) => path.join(import.meta.dirname, "features", `test_e2e_${name}_batch.ts`)),
});
if (!process.exitCode) await BatchWorkspace.close();


