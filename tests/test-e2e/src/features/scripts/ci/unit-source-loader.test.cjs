const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");
const repository = path.resolve(__dirname, "../../../../../..");

test("source units load workspace TypeScript while dependencies keep runtime exports", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unit-loader-"));
  try {
    const files = {
      "package.json": JSON.stringify({ type: "module" }),
      "node_modules/ttsc/package.json": JSON.stringify({
        name: "ttsc",
        type: "module",
        exports: {
          "./path-identity": { types: "./wrong.ts", default: "./wrong.js" },
        },
      }),
      "node_modules/ttsc/wrong.ts":
        'export const resolveFilesystemPath = () => { throw new Error("foreign ttsc package selected"); };',
      "contract.ts":
        "export namespace Contract { export const twice = (value: number): number => value * 2; }",
      "node_modules/dependency/package.json": JSON.stringify({
        name: "dependency",
        type: "module",
        exports: { types: "./declaration-only.d.ts", default: "./runtime.js" },
      }),
      "node_modules/dependency/runtime.js": "export const value = 21;",
      "main.ts": [
        'import { Contract } from "./contract.ts";',
        'import { resolveFilesystemPath } from "ttsc/path-identity";',
        'import { value } from "dependency";',
        'console.log(JSON.stringify([Contract.twice(value), resolveFilesystemPath("/root/../owned", "linux"), resolveFilesystemPath("C:/root/../owned", "win32")]));',
        'try { await import("ttsc/internal/pluginSource"); throw new Error("private export admitted"); } catch (error) { if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error; }',
      ].join("\n"),
    };
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const result = cp.spawnSync(
      process.execPath,
      [
        "--import",
        pathToFileURL(path.resolve(path.resolve(__dirname, "../../../../../../scripts/ci"), "../register-unit-loader.mjs"))
          .href,
        path.join(scratch, "main.ts"),
      ],
      { cwd: scratch, encoding: "utf8", windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), JSON.stringify([42, "/owned", "C:\\owned"]));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("local suites select both layers, preserve empty-selection failures and collect unit failures", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unit-dispatch-"));
  try {
    const helper = (name) =>
      pathToFileURL(path.resolve(path.resolve(__dirname, "../../../../../../scripts/ci"), "../../tests/utils/src", name))
        .href;
    const files = {
      "package.json": JSON.stringify({ type: "module" }),
      "test-unit/src/features/test_unit_marker.ts":
        'export const test_unit_marker = () => { console.log("UNIT_MARKER"); if (process.env.FAIL_UNIT === "1") throw new Error("unit fixture failed"); };',
      "test-boundary/src/features/test_boundary_marker.ts":
        'export const test_boundary_marker = () => { console.log("BOUNDARY_MARKER"); };',
      "main.ts": [
        'import path from "node:path";',
        `import { TestExecutor } from ${JSON.stringify(helper("TestExecutor.ts"))};`,
        'import cp from "node:child_process";',
        'const unit = path.resolve("test-unit");',
        'const boundaries = path.resolve("test-boundary/src/features");',
        'const unitsSelected = TestExecutor.hasCases({ location: path.join(unit, "src/features") });',
        'const boundariesSelected = TestExecutor.hasCases({ location: boundaries });',
        'if (unitsSelected) { const result = cp.spawnSync(process.execPath, ["--import", '+JSON.stringify(require('node:url').pathToFileURL(path.join(repository, 'scripts/register-unit-loader.mjs')).href)+', '+JSON.stringify(path.join(repository, 'scripts/ci/run-source-units.mts'))+', ...process.argv.slice(2)], { cwd: unit, env: process.env, stdio: "inherit", windowsHide: true }); if (result.status !== 0) process.exitCode = 1; }',
        'if (boundariesSelected || !unitsSelected) TestExecutor.main({ location: boundaries }).catch(() => { process.exitCode = 1; });',
      ].join("\n"),
    };
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    const run = (args, env = {}) =>
      cp.spawnSync(
        process.execPath,
        [
          "--import",
          pathToFileURL(
            path.resolve(path.resolve(__dirname, "../../../../../../scripts/ci"), "../register-typescript-loader.mjs"),
          ).href,
          path.join(scratch, "main.ts"),
          ...args,
        ],
        {
          cwd: scratch,
          encoding: "utf8",
          windowsHide: true,
          env: { ...process.env, TTSC_TEST_WORKERS: "1", ...env },
        },
      );
    for (const [args, units, boundaries] of [
      [[], 1, 1],
      [["--include=unit_marker"], 1, 0],
      [["--include=boundary_marker"], 0, 1],
      [["--exclude=unit_marker"], 0, 1],
    ]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.split("UNIT_MARKER").length - 1, units);
      assert.equal(
        result.stdout.split("BOUNDARY_MARKER").length - 1,
        boundaries,
      );
    }
    const empty = run(["--include=missing_case"]);
    assert.notEqual(empty.status, 0);
    assert.match(empty.stderr, /No tests matched/);
    const failing = run([], { FAIL_UNIT: "1" });
    assert.notEqual(failing.status, 0);
    assert.match(failing.stderr, /unit fixture failed/);
    assert.match(failing.stdout, /BOUNDARY_MARKER/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
