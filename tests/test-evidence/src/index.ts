import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";
import { suiteRoot } from "./internal/suiteRoot";

// The rule contracts still invoke the real compiler. The runner itself uses
// the shared loader so its runtime preload cannot leak into those consumers.
TestExecutor.main({
  location: path.join(suiteRoot, "src", "features"),
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
