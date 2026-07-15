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
  "test-go-lint.cjs",
  "test-go-graph.cjs",
];

// Unit tests for the runner harness itself (the flatten collision guard and
// this aggregation). Run first so a broken harness is reported before the long
// Go suites execute, and so both CI Go lanes (ubuntu + windows) cover them.
const harnessTest = path.join(__dirname, "ci", "go-test-runners.test.cjs");

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
  if (spawnNode(["--test", harnessTest]) !== 0) {
    failed.push("ci/go-test-runners.test.cjs");
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
