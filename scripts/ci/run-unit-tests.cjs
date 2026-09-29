const cp = require("node:child_process");
const path = require("node:path");
const { selectedNodeTests } = require("./node-tests.cjs");
const { GO_UNIT_RUNNERS } = require("../test-go.cjs");
const { runIndependent } = require("./run-independent.cjs");

const root = path.resolve(__dirname, "../..");

/** Run in-process unit contracts without building or installing a product CLI. */
async function main() {
  const nodeTests = ["go", "typecheck", "package-defenses"].flatMap((lane) =>
    selectedNodeTests(root, lane, "unit"),
  );
  if (nodeTests.length === 0) throw new Error("no unit tests discovered");
  const steps = [
    { name: "Node units", args: ["--test", ...nodeTests] },
    ...GO_UNIT_RUNNERS.map((runner) => ({
      name: runner,
      args: [path.join(root, "scripts", runner)],
    })),
  ];
  const failures = await runIndependent(
    steps,
    (step) =>
      new Promise((resolve) => {
        const started = process.hrtime.bigint();
        console.log(`Unit: ${step.name}`);
        const child = cp.spawn(process.execPath, step.args, {
          cwd: root,
          env: { ...process.env, TTSC_TEST_LAYER: "unit" },
          stdio: "inherit",
          windowsHide: true,
        });
        child.on("error", (error) => console.error(error));
        child.on("close", (code) => {
          const seconds = Number(process.hrtime.bigint() - started) / 1e9;
          console.log(
            `Unit: ${step.name}: ${code === 0 ? "passed" : "FAILED"} in ${seconds.toFixed(1)} s`,
          );
          resolve(code ?? 1);
        });
      }),
    2,
  );
  if (failures.length) {
    console.error(`Failed units: ${failures.map((step) => step.name).join(", ")}`);
    process.exitCode = 1;
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
