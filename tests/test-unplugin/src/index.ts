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
// That directory is only ever this package's test output, so the runner
// removes it as it exits, however it exits: the executor ends a failed run
// with `process.exit` itself, which nothing after `main` would see. A run
// killed outright leaves it to the next run. The path is fixed here because
// scenarios move the working directory, and the runner's own stays where it
// is: its workers inherit the relative `--import` it was started with. A
// directory it cannot remove is named, not turned into a failure of scenarios
// that passed.
const tool = path.join(process.cwd(), ".ttsc");
process.on("exit", () => {
  try {
    fs.rmSync(tool, { force: true, recursive: true });
  } catch (error) {
    fs.writeSync(
      2,
      `The runner could not remove ${tool}: ${(error as Error).message}\n`,
    );
  }
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
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
