import { TestExecutor } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

const base = path.join(process.cwd(), "src");
const dir = process.env.TTSC_TEST_DIR;
const dirs = process.env.TTSC_TEST_DIRS?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

// Every adapter under test keeps its project records below the tool directory
// of the directory it runs in (`hostToolDirectory`), which is this package's.
// That directory is only ever this package's test output, so a run removes it
// when it ends, a run killed earlier included, and leaves nothing in the
// repository. The runner's own working directory stays where it is: its
// workers inherit the relative `--import` it was started with.
const release = () =>
  fs.rmSync(path.join(process.cwd(), ".ttsc"), {
    force: true,
    recursive: true,
  });

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
}).then(release, (error) => {
  release();
  console.error(error);
  process.exit(1);
});
