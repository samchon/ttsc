const cp = require("node:child_process");
const path = require("node:path");
const { LANES, validationSteps } = require("./validation-suites.cjs");
const { runIndependent } = require("./run-independent.cjs");

/** Run every independent step and return all failed commands. */
async function runAll(steps, execute, concurrency = 1) {
  return (await runIndependent(steps, execute, concurrency)).map(
    (step) => step.run,
  );
}

function execute(step) {
  console.log(`\nValidation: ${step.run}`);
  return new Promise((resolve) => {
    const child = cp.spawn(step.run, {
      cwd: path.resolve(__dirname, "../.."),
      shell: true,
      env: {
        ...process.env,
        TTSC_TEST_DIR: "",
        TTSC_TEST_DIRS: step.dirs.join(","),
      },
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", (error) => console.error(error));
    child.on("close", (code) => resolve(code ?? 1));
  });
}

if (require.main === module) {
  const argument = process.argv.find((entry) => entry.startsWith("--lanes="));
  if (!argument) throw new Error("expected --lanes=<logical lane IDs>");
  const selection = argument.slice("--lanes=".length);
  const steps = validationSteps(
    selection === "all"
      ? LANES.filter((lane) => !lane.node).map((lane) => lane.id)
      : selection.split(","),
  );
  const concurrency = Number(
    process.argv
      .find((entry) => entry.startsWith("--concurrency="))
      ?.slice("--concurrency=".length) ?? 1,
  );
  runAll(steps, execute, concurrency).then(
    (failures) => {
      if (failures.length)
        console.error(`Failed validation: ${failures.join(", ")}`);
      process.exitCode = failures.length ? 1 : 0;
    },
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
}

module.exports = { runAll };
