import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "features"),
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
