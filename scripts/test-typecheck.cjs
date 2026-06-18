const child_process = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

for (const project of projects) {
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
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
