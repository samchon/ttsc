const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const loader = pathToFileURL(
  path.join(path.resolve(__dirname, "../../../../../../scripts/ci"), "..", "register-typescript-loader.mjs"),
).href;

// The test suites and benchmark harnesses start through this loader with
// `--experimental-strip-types`, the one TypeScript flag every supported Node
// accepts. Their sources declare runtime namespaces, which type stripping
// rejects and which Node 26 can no longer transform (samchon/ttsc#1574), so
// the loader has to compile them itself, for ESM and CommonJS alike.
function run(files, entry) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-typescript-loader-"));
  try {
    for (const [file, text] of Object.entries(files)) {
      fs.writeFileSync(path.join(root, file), text, "utf8");
    }
    return childProcess.spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--experimental-strip-types",
        "--import",
        loader,
        path.join(root, entry),
      ],
      { cwd: root, encoding: "utf8" },
    );
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

test("the TypeScript loader runs syntax that type stripping rejects", () => {
  const result = run(
    {
      "package.json": '{ "type": "module" }\n',
      "counter.ts": [
        "export namespace Counter {",
        "  export const start: number = 1;",
        "  export function next(value: number): number {",
        "    return value + start;",
        "  }",
        "}",
        "export enum Kind { Zero, One }",
        "export class Box {",
        "  public constructor(public readonly value: number) {}",
        "}",
        "",
      ].join("\n"),
      "legacy.cts": [
        "namespace Legacy {",
        "  export const value: string = \"cts\";",
        "}",
        "export = Legacy;",
        "",
      ].join("\n"),
      "main.ts": [
        'import { Box, Counter, Kind } from "./counter";',
        'import legacy from "./legacy.cts";',
        "console.log(JSON.stringify([Counter.next(1), Kind.One, new Box(3).value, legacy.value]));",
        "",
      ].join("\n"),
    },
    "main.ts",
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), JSON.stringify([2, 1, 3, "cts"]));
});

test("the TypeScript loader reports a failure at its TypeScript line", () => {
  const result = run(
    {
      "package.json": '{ "type": "module" }\n',
      "fail.ts": [
        "export namespace Failure {",
        "  export function raise(): never {",
        "    const message: string = \"raised\";",
        "    throw new Error(message);",
        "  }",
        "}",
        "Failure.raise();",
        "",
      ].join("\n"),
    },
    "fail.ts",
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /fail\.ts:4:\d+/);
});
