import { fileURLToPath } from "node:url";

import { TestExecutor } from "../../../utils/src/TestExecutor";

TestExecutor.main({
  location: fileURLToPath(new URL(".", import.meta.url)),
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
