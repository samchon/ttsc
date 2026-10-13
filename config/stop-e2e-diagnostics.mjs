import path from "node:path";

import { WindowsColdFileIo } from "../tests/utils/src/WindowsColdFileIo.ts";

// The ordinary E2E owner stops these sessions first. Interrupted Node owners
// can leave native loggers alive, so CI retires only this run's exact manifests.
if (process.platform === "win32" && process.env.TTSC_E2E_GRAPH_FILEIO === "1") {
  const root = process.env.TTSC_E2E_TRACE;
  if (!root || !path.isAbsolute(root)) throw new Error("Missing owned E2E diagnostic root");
  await WindowsColdFileIo.cleanup(root, path.resolve(import.meta.dirname, "../tests/test-e2e/fixtures/graph/windows-fileio-observer.ps1"), process.env.RUNNER_TEMP ?? "");
}
