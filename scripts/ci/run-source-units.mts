import path from "node:path";

import { TestExecutor } from "../../tests/utils/src/TestExecutor";

// Each suite retains its own cwd and serial fixture/global-state ownership.
TestExecutor.main({
  location: path.join(process.cwd(), "src", "unit"),
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
