import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;

TestExecutor.main({
  // A CI lane sets `TTSC_TEST_DIR` to one subtree — `features` (fast tests) or a
  // `native/<category>` folder (go-binary builders). A plain local run leaves it
  // unset and exercises both trees.
  location: dir
    ? path.join(base, dir)
    : [path.join(base, "features"), path.join(base, "native")],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
