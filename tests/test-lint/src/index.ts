import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;
const dirs = process.env.TTSC_TEST_DIRS?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

TestExecutor.main({
  // One broad CI defense scans the cheap and native trees in one process. Each
  // named subcase stays independently reported while the expensive lint
  // sidecar build is reused.
  location: dirs?.length
    ? dirs.map((value) => path.join(base, value))
    : dir
      ? path.join(base, dir)
      : [path.join(base, "features"), path.join(base, "native-plugins")],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
