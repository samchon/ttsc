import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;
const dirs = process.env.TTSC_TEST_DIRS?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

TestExecutor.main({
  // `features` holds the scenarios that need neither a Go host nor a bundler
  // process; `native-plugins` holds every scenario that builds the native
  // compiler or drives a real host. CI lanes select one tree through
  // `TTSC_TEST_DIRS`, and a plain local run executes both.
  location: dirs?.length
    ? dirs.map((value) => path.join(base, value))
    : dir
      ? path.join(base, dir)
      : [path.join(base, "features"), path.join(base, "native-plugins")],
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
