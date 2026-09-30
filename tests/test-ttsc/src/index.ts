import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

import { TestSourceUnits } from "../../utils/src/TestSourceUnits";

const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;
const dirs = process.env.TTSC_TEST_DIRS?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const boundaries = [
  path.join(base, "features"),
  path.join(base, "native-plugins"),
];
const runBoundaries =
  process.env.TTSC_TEST_LAYER === "e2e" || dir || dirs?.length
    ? true
    : TestSourceUnits.run(boundaries);

if (runBoundaries) {
  TestExecutor.main({
    // CI topology lanes pass several directories in one process so related
    // scenarios share built packages and the content-addressed plugin cache.
    // The singular variable remains a local/debug compatibility surface.
    location: dirs?.length
      ? dirs.map((value) => path.join(base, value))
      : dir
        ? path.join(base, dir)
        : boundaries,
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
