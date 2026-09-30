import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

// The map and embedded-source entries consume one completed compiler load.
// Keep them in one process even when the outer validation lane uses workers.
process.env.TTSC_TEST_WORKERS = "1";

TestExecutor.main({
  location: [
    path.join(process.cwd(), "src", "features"),
    path.join(process.cwd(), "src", "native-plugins"),
  ],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
