const child_process = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { runIndependent } = require("./ci/run-independent.cjs");

const workspaceRoot = path.resolve(__dirname, "..");
const testsRoot = path.join(workspaceRoot, "tests");

const projects = fs
  .readdirSync(testsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(testsRoot, entry.name))
  .filter((dir) => fs.existsSync(path.join(dir, "package.json")))
  .filter((dir) => fs.existsSync(path.join(dir, "tsconfig.json")))
  .sort();

if (projects.length === 0) {
  console.error("No test tsconfig.json files were discovered.");
  process.exit(1);
}

async function main() {
  const failures = await runIndependent(projects, (project) => {
    const label = path.relative(workspaceRoot, project);
    console.log(`typecheck ${label}`);
    const result = child_process.spawnSync(
      "tsc",
      ["--noEmit", "-p", path.join(project, "tsconfig.json")],
      {
        cwd: workspaceRoot,
        encoding: "utf8",
        shell: process.platform === "win32",
        stdio: "inherit",
        windowsHide: true,
      },
    );
    if (result.error) console.error(result.error);
    return result.error ? 1 : result.status ?? 1;
  });
  if (failures.length) {
    console.error(
      `Failed typecheck projects: ${failures.map((project) => path.relative(workspaceRoot, project)).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
