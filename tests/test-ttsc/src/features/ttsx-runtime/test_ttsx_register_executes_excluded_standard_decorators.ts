import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../internal/ttsx-decorators";
import { TTSX_REGISTER, linkTtscPackage } from "../../internal/ttsx-register";

/**
 * Verifies registered and direct excluded entries lower inherited decorators.
 *
 * The entry-only fallback builds a second project, and the public preload
 * shares that preparation. Both must retain runtime lowering through extends.
 *
 * 1. Exclude a decorated script from a project's included source tree.
 * 2. Execute it with ttsx and the public Node preload in both module formats.
 * 3. Assert the same class and method effects in all runs.
 */
export const test_ttsx_register_executes_excluded_standard_decorators = () => {
  for (const module of ["esnext", "commonjs"]) {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        type: module === "commonjs" ? "commonjs" : "module",
      }),
      "base.json": JSON.stringify({
        compilerOptions: { target: "ESNext", module, strict: true },
      }),
      "tsconfig.json": JSON.stringify({
        extends: "./base.json",
        compilerOptions: { rootDir: "src", outDir: "dist" },
        include: ["src"],
      }),
      "src/included.ts": "export const included = true;",
      "scripts/main.ts": STANDARD_DECORATOR_SOURCE,
    });
    linkTtscPackage(root);
    for (const [command, args] of [
      [TestProject.TTSX_BIN, ["scripts/main.ts"]],
      [process.execPath, ["--require", TTSX_REGISTER, "scripts/main.ts"]],
    ] as const) {
      const result = TestProject.spawn(command, [...args], { cwd: root });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT);
    }
  }
};
