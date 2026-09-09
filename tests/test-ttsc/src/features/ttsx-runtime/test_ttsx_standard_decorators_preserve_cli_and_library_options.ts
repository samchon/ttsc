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
 * module kind. CLI aliases, casing, and repeated targets must still win.
 *
 * 1. Select ESNext through the config and through several CLI spellings.
 * 2. Use Disposable and import attributes without explicit lib or module.
 * 3. Assert successful checking and execution, then retain an explicit ESNext lib.
 */
export const test_ttsx_standard_decorators_preserve_cli_and_library_options =
  () => {
    for (const args of [
      [],
      ["-t", "esnext"],
      ["--TARGET", "ESNEXT"],
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
    for (const cliLib of [false, true]) {
      const root = TestProject.createProject({
        "package.json": '{"type":"module"}',
        "tsconfig.json": TestProject.tsconfig({
          target: "ESNext",
          module: "esnext",
          strict: true,
          rootDir: "src",
          outDir: "dist",
          ...(cliLib ? {} : { lib: ["esnext"] }),
        }),
        "src/main.ts":
          'declare const console: { log(...args: unknown[]): void };\nif (false) {\n// @ts-expect-error DOM must remain absent.\ndocument.title = "forbidden";\n}\n' +
          STANDARD_DECORATOR_SOURCE,
      });
      const result = TestProject.spawn(
        TestProject.TTSX_BIN,
        [...(cliLib ? ["--lib", "esnext"] : []), "src/main.ts"],
        { cwd: root },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    }
  };
