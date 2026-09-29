// Orchestrate every Go test runner behind `pnpm test:go`.
//
// package.json previously chained the runners with `&&`, so the first failing
// runner short-circuited the rest — test-go-graph.cjs never ran once an earlier
// suite failed, leaving it with no CI signal (issue #622). This orchestrator
// runs each runner regardless of earlier failures and exits non-zero if any of
// them did, naming the failures so no red suite hides behind another.

const cp = require("node:child_process");
const path = require("node:path");

const { selectedNodeTests } = require("./ci/node-tests.cjs");
const { runIndependent } = require("./ci/run-independent.cjs");

const root = path.resolve(__dirname, "..");

const runners = [
  "test-go-driver.cjs",
  "test-go-ttsc.cjs",
  "test-go-transformer.cjs",
  "test-go-utility-plugins.cjs",
  "test-go-wasm.cjs",
  "test-go-lint.cjs",
  "test-go-evidence.cjs",
  "test-go-graph.cjs",
  "test-go-shim.cjs",
];

// These suites call Go APIs in process and need no built product CLI. The
// remaining runners include real command, runtime, plugin or filesystem
// integration contracts.
const GO_UNIT_ONLY_RUNNERS = [
  "test-go-driver.cjs",
  "test-go-transformer.cjs",
  "test-go-shim.cjs",
];
const GO_UNIT_RUNNERS = [
  ...GO_UNIT_ONLY_RUNNERS,
  "test-go-lint.cjs",
  "test-go-evidence.cjs",
];

function selectedRunners(layer = process.env.TTSC_TEST_LAYER) {
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown TTSC_TEST_LAYER: ${layer}`);
  return runners.filter(
    (runner) =>
      !layer ||
      (layer === "unit"
        ? GO_UNIT_RUNNERS.includes(runner)
        : !GO_UNIT_ONLY_RUNNERS.includes(runner)),
  );
}

// Fast Node checks run before the long Go suites so both CI Go lanes cover the
// runner harness and the Go build helpers: every `scripts/*.test.cjs`,
// discovered, so a new one runs without editing a list (`ci/node-tests.cjs`).
const harnessTests = selectedNodeTests(root, "go").map((relative) =>
  path.join(root, ...relative.split("/")),
);

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
  return new Promise((resolve) => {
    const child = cp.spawn(process.execPath, [path.join(__dirname, runner)], {
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", (error) => console.error(error));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const failed = [];
  for (const test of harnessTests) {
    if (spawnNode(["--test", test]) !== 0) {
      failed.push(path.relative(__dirname, test));
    }
  }
  failed.push(
    ...(await runIndependent(
      selectedRunners(),
      spawnRunner,
      Number(process.env.TTSC_GO_TEST_WORKERS ?? 1),
    )),
  );
  if (failed.length > 0) {
    console.error(
      `\ntest:go: ${failed.length} step(s) failed: ${failed.join(", ")}`,
    );
    process.exit(1);
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = { runAll, GO_UNIT_RUNNERS, selectedRunners };
