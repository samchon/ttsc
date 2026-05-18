import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../internal/TestPaths";

/**
 * Verifies the @ttsc/paths plugin: NodeNext output extensions come from
 * tsconfig.
 *
 * This project-shaped case keeps module-kind extension rewriting in the paths
 * package instead of hiding it inside a Go-only unit test. The temporary files
 * mix `.mts` and `.cts` inputs so the emitted specifiers must become `.mjs` and
 * `.cjs` under the same `compilerOptions.paths` rewrite table.
 *
 * 1. Build a NodeNext project with alias targets pointing at `.mts` and `.cts`.
 * 2. Run real ttsc with `@ttsc/paths` loaded from that project's tsconfig.
 * 3. Assert JavaScript and declaration outputs use the correct runtime suffixes.
 */
export const test_paths_uses_nodenext_output_extensions_from_tsconfig = () => {
  const files: Record<string, string> = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        declaration: true,
        strict: true,
        paths: {
          "@lib/constant": ["./src/modules/constant.cts"],
          "@lib/message": ["./src/modules/message.mts"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/main.mts": [
      `import { message } from "@lib/message";`,
      `export type ImportedMessage = import("@lib/message").Message;`,
      `export const value = message;`,
      ``,
    ].join("\n"),
    "src/modules/constant.cts": `export const constant = "cjs" as const;\n`,
    "src/modules/message.mts": [
      `export interface Message { value: string }`,
      `export const message = "esm" as const;`,
      ``,
    ].join("\n"),
    "src/require-consumer.cts": [
      `declare const require: (id: string) => unknown;`,
      `export const loaded = require("@lib/constant");`,
      ``,
    ].join("\n"),
  };
  const root = TestProject.createProject(files);
  TestPaths.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-paths-nodenext-extensions-"),
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);

  const mjs = fs.readFileSync(path.join(root, "dist", "main.mjs"), "utf8");
  assert.match(mjs, /from "\.\/modules\/message\.mjs"/);
  assert.doesNotMatch(mjs, /@lib\/message/);

  const cjs = fs.readFileSync(
    path.join(root, "dist", "require-consumer.cjs"),
    "utf8",
  );
  assert.match(cjs, /require\("\.\/modules\/constant\.cjs"\)/);
  assert.doesNotMatch(cjs, /@lib\/constant/);

  const dts = fs.readFileSync(path.join(root, "dist", "main.d.mts"), "utf8");
  assert.match(dts, /import\("\.\/modules\/message\.mjs"\)/);
  assert.doesNotMatch(dts, /@lib\/message/);
};
