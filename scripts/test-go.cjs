// Orchestrate every Go test runner behind `pnpm test:go`.
//
// package.json previously chained the runners with `&&`, so the first failing
// runner short-circuited the rest — test-go-graph.cjs never ran once an earlier
// suite failed, leaving it with no CI signal (issue #622). This orchestrator
// runs each runner regardless of earlier failures and exits non-zero if any of
// them did, naming the failures so no red suite hides behind another.

const cp = require("node:child_process");
const path = require("node:path");

const runners = [
  "test-go-driver.cjs",
  "test-go-ttsc.cjs",
  "test-go-transformer.cjs",
  "test-go-utility-plugins.cjs",
  "test-go-wasm.cjs",
  "test-go-lint.cjs",
  "test-go-graph.cjs",
];

// Fast Node checks run before the long Go suites so both CI Go lanes cover the
// runner harness and the project Layout contract.
const harnessTests = [
  path.join(__dirname, "ci", "go-test-runners.test.cjs"),
  path.join(__dirname, "ci", "website-compiler-module.test.cjs"),
  path.join(__dirname, "assert-project-layout.test.cjs"),
  path.join(__dirname, "go-build-cache.test.cjs"),
  path.join(__dirname, "go-build-cache-builders.test.cjs"),
];

// runAll invokes every entry through `spawn` and returns the list that failed.
// `spawn` is injected so the meta-test can assert each runner is invoked even
// when an earlier one fails — the exact regression the `&&` chain hid.
function runAll(list, spawn) {
  const failed = [];
  for (const entry of list) {
    if (spawn(entry) !== 0) failed.push(entry);
  }
  return failed;
}

function spawnNode(args) {
  const result = cp.spawnSync(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function spawnRunner(runner) {
  return spawnNode([path.join(__dirname, runner)]);
}

if (require.main === module) {
  const failed = [];
  for (const test of harnessTests) {
    if (spawnNode(["--test", test]) !== 0) {
      failed.push(path.relative(__dirname, test));
    }
  }
  failed.push(...runAll(runners, spawnRunner));
  if (failed.length > 0) {
    console.error(
      `\ntest:go: ${failed.length} step(s) failed: ${failed.join(", ")}`,
    );
    process.exit(1);
  }
}

module.exports = { runAll, runners };
