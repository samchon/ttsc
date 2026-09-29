// Run every independent quality gate after the shared build, even when an
// earlier gate fails. A deferred format difference must not hide TypeScript
// type errors from the same CI head. Adapter features join their native cases
// in the validation suite's one adapter executor.

const childProcess = require("node:child_process");
const path = require("node:path");

const { discoverNodeTests } = require("./node-tests.cjs");

const root = path.resolve(__dirname, "..", "..");

/** Return every failed step name while still invoking every selected step. */
function runAll(steps, execute) {
  const failed = [];
  for (const step of steps) {
    if (execute(step) !== 0) failed.push(step.name);
  }
  return failed;
}

function runStep(step) {
  const command =
    step.command === "pnpm" && process.platform === "win32"
      ? "pnpm.cmd"
      : step.command;
  const result = childProcess.spawnSync(command, step.args, {
    cwd: root,
    shell: process.platform === "win32" && step.command === "pnpm",
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    console.error(`${step.name}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (require.main === module) {
  const nodeTests = discoverNodeTests(root, "typecheck").map((relative) =>
    path.join(root, ...relative.split("/")),
  );
  const steps = [
    { name: "flag schema", command: "pnpm", args: ["run", "check:flags"] },
    {
      name: "dependency audit",
      command: "pnpm",
      args: ["run", "check:dependencies"],
    },
    { name: "Node harness", command: process.execPath, args: ["--test", ...nodeTests] },
    {
      name: "format check",
      command: process.execPath,
      args: ["scripts/ci/format-check.cjs"],
    },
    { name: "TypeScript types", command: "pnpm", args: ["run", "test:typecheck"] },
  ];
  const failed = runAll(steps, runStep);
  if (failed.length !== 0) {
    console.error(`typecheck: ${failed.length} step(s) failed: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

module.exports = { runAll };
