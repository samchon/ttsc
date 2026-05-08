import path from "node:path";

import { TestExecutor } from "@ttsc/testing";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "features"),
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
