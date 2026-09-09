import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator export hints preserve a conditional helper call.
 *
 * A helper-shaped statement can be the unbraced body of an if. Adding metadata
 * must keep it one statement so neither its require nor its helper escapes that
 * if.
 *
 * 1. Put an export-star helper call behind an unbraced false condition.
 * 2. Make its dependency throw if evaluated and load the decorated source.
 * 3. Assert normal decoration, no dependency execution and no runtime export.
 */
export const test_ttsx_decorator_export_hints_preserve_conditional_execution =
  () => {
    const root = TestProject.createProject({
      "package.json": '{"type":"module"}',
      "tsconfig.json": TestProject.tsconfig({
        target: "ES2022",
        module: "esnext",
        rootDir: "src",
        outDir: "dist",
      }),
      "src/main.ts":
        'const name: string = "dep"; const dep = await import(name); console.log(dep.actual, Object.hasOwn(dep.default, "hidden")); export {};',
      "node_modules/dep/package.json":
        '{"name":"dep","type":"commonjs","exports":"./index.ts"}',
      "node_modules/dep/index.ts":
        STANDARD_DECORATOR_SOURCE +
        '\nexport const actual = 17;\ndeclare function __exportStar(value: unknown, target: unknown): void;\ndeclare function require(name: string): unknown;\ndeclare const exports: unknown;\nif (false)\n  __exportStar(require("./hidden"), exports);',
      "node_modules/dep/hidden.ts":
        'throw new Error("must-not-execute"); export const hidden = 42;',
    });
    const result = TestProject.spawn(TestProject.TTSX_BIN, ["src/main.ts"], {
      cwd: root,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout.trim(),
      STANDARD_DECORATOR_OUTPUT + "\n17 false",
    );
  };
