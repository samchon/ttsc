import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";

/**
 * Verifies decorator lowering preserves ESNext libraries and implicit modules.
 *
 * Replacing the target alone drops proposal types and changes the implicit
 * module kind. Portable alias, casing, library and repeated-target decisions are owned by
 * the source-unit argument matrix; this batch retains actual compiler and host
 * execution for config-derived and CLI-derived ESNext plus explicit libraries.
 *
 * 1. Select ESNext through the config and a repeated CLI override.
 * 2. Use Disposable and import attributes without explicit lib or module.
 * 3. Assert successful checking and execution, then retain an explicit ESNext lib.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx checks Disposable/import attributes and executes standard decorators with implicit modules/libraries, then executes with explicit ESNext-only libraries and the DOM-negative directive.
 * @evidence contracts/testing.md#independent-expectations Authored decorator effects plus JSON value 42 define outputs; the type-error directive establishes DOM absence independently of runtime flags.
 * @evidence contracts/testing.md#distinguishing-cases Config and CLI-derived ESNext both retain proposal types and implicit modules; explicit libraries retain the adjacent DOM exclusion. Aliases, casing and library flag spellings execute in the argument-owner source unit.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns real compiler/Node execution; portable argument Cartesian decisions are separately discoverable in test_runtime_compiler_args_preserves_options_and_lowers_only_unexecutable_syntax.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler must type-check proposal types and lower decorators into JavaScript Node executes while preserving library/module meaning; argument arrays alone cannot prove that assembly.
 * @evidence contracts/e2e.md#shared-execution Three genuinely different checked option sets retain compiler/host lifetimes: implicit config ESNext, forwarded overriding ESNext and explicit ESNext-only libraries. Equivalent alias/case and config-versus-CLI library decisions use one portable unit process instead of repeated emit.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each differing compiler option set receives an independent fresh project so effective libraries and module decisions cannot inherit another run; launchers finish and own emit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Surviving hosts assert the original decorator outputs, JSON import and DOM-negative checking; the source argument matrix independently retains every removed alias/case/library-token decision and expected compiler input.
 */
export function test_ttsx_standard_decorators_preserve_cli_and_library_options() {
    for (const args of [
      [],
      ["--target", "es2019", "-target", "esnext"],
    ]) {
      const root = TestProject.createProject({
        "package.json": JSON.stringify({ type: "module" }),
        "tsconfig.json": TestProject.tsconfig({
          target: args.length ? "ES2019" : "ESNext",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          resolveJsonModule: true,
        }),
        "src/data.json": '{"value":42}',
        "src/main.ts":
          `import data from "./data.json" with { type: "json" };\nlet disposal: Disposable | undefined; void disposal;\n` +
          STANDARD_DECORATOR_SOURCE +
          "\nconsole.log(data.value);",
      });
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        [...args, "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT + "\n42");
    }
    {
      const root = TestProject.createProject({
        "package.json": '{"type":"module"}',
        "tsconfig.json": TestProject.tsconfig({
          target: "ESNext",
          module: "esnext",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          lib: ["esnext"],
        }),
        "src/main.ts":
          'declare const console: { log(...args: unknown[]): void };\nif (false) {\n// @ts-expect-error DOM must remain absent.\ndocument.title = "forbidden";\n}\n' +
          STANDARD_DECORATOR_SOURCE,
      });
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        ["src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    }
}