const cp = require("node:child_process");
const path = require("node:path");
const { validationSteps } = require("./validation-plan.cjs");

/** Run every independent step and return all failed commands. */
function runAll(steps, execute) {
  return steps.filter((step) => execute(step) !== 0).map((step) => step.run);
}

function execute(step) {
  console.log(`\nValidation: ${step.run}`);
  const result = cp.spawnSync(step.run, {
    cwd: path.resolve(__dirname, "../.."), shell: true,
    env: { ...process.env, TTSC_TEST_DIR: "", TTSC_TEST_DIRS: step.dirs.join(",") },
    stdio: "inherit", windowsHide: true,
  });
  if (result.error) console.error(result.error);
  return result.error ? 1 : result.status ?? 1;
}

if (require.main === module) {
  const argument = process.argv.find((entry) => entry.startsWith("--lanes="));
  if (!argument) throw new Error("expected --lanes=<logical lane IDs>");
  const steps = validationSteps(argument.slice("--lanes=".length).split(","), process.platform);
  const failures = runAll(steps, execute);
  if (failures.length) console.error(`Failed validation: ${failures.join(", ")}`);
  process.exitCode = failures.length ? 1 : 0;
}

module.exports = { runAll };
