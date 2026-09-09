import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies ttsx executes standard decorators at ESNext in both module formats.
 *
 * #1359 compiles successfully but gives Node preserved decorator syntax. The
 * runtime must lower it while ordinary builds retain their configured target.
 *
 * 1. Build the reported class/method example with ordinary ttsc.
 * 2. Run ttsx for ESNext, CommonJS, and NodeNext extension overrides.
 * 3. Assert decorator effects and unchanged source, config, and published emit.
 */
export const test_ttsx_executes_standard_decorators_at_esnext = () => {
  for (const [module, extension] of [
    ["esnext", "ts"],
    ["commonjs", "ts"],
    ["nodenext", "mts"],
    ["nodenext", "cts"],
  ]) {
    const entry = `src/main.${extension}`;
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        type: module === "commonjs" ? "commonjs" : "module",
      }),
      "tsconfig.json": TestProject.tsconfig({
        target: "ESNext",
        module,
        strict: true,
        rootDir: "src",
        outDir: "dist",
        declaration: true,
      }),
      [entry]: STANDARD_DECORATOR_SOURCE,
    });
    const config = fs.readFileSync(path.join(root, "tsconfig.json"), "utf8");
    const built = TestProject.spawn(TestProject.TTSC_BIN, ["--emit"], {
      cwd: root,
    });
    assert.equal(built.status, 0, built.stderr);
    const output = path.join(
      root,
      "dist",
      `main.${extension === "mts" ? "mjs" : extension === "cts" ? "cjs" : "js"}`,
    );
    const emitted = fs.readFileSync(output, "utf8");
    assert.match(emitted, /@sayHelloClass/);
    const result = TestProject.spawn(TestProject.TTSX_BIN, [entry], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    assert.equal(fs.readFileSync(output, "utf8"), emitted);
    assert.equal(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      config,
    );
    assert.equal(
      fs.readFileSync(path.join(root, entry), "utf8"),
      STANDARD_DECORATOR_SOURCE,
    );
  }
};
