const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

test("source units load workspace TypeScript while dependencies keep runtime exports", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unit-loader-"));
  try {
    const files = {
      "package.json": JSON.stringify({ type: "module" }),
      "node_modules/ttsc/package.json": JSON.stringify({
        name: "ttsc",
        type: "module",
        exports: {
          "./contract": { types: "./contract.ts", default: "./unbuilt.js" },
        },
      }),
      "node_modules/ttsc/contract.ts":
        "export namespace Contract { export const twice = (value: number): number => value * 2; }",
      "node_modules/dependency/package.json": JSON.stringify({
        name: "dependency",
        type: "module",
        exports: { types: "./declaration-only.d.ts", default: "./runtime.js" },
      }),
      "node_modules/dependency/runtime.js": "export const value = 21;",
      "main.ts": [
        'import { Contract } from "ttsc/contract";',
        'import { value } from "dependency";',
        "console.log(Contract.twice(value));",
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
        pathToFileURL(path.resolve(__dirname, "../register-unit-loader.mjs"))
          .href,
        path.join(scratch, "main.ts"),
      ],
      { cwd: scratch, encoding: "utf8", windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "42");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
