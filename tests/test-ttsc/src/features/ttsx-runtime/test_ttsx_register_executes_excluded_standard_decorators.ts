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
 * @evidence contracts/testing.md#behavioral-verification Actual direct ttsx and public ttsc/register execute an excluded decorated script inheriting ESNext through extends, requiring zero status and exact class/method effects.
 * @evidence contracts/testing.md#independent-expectations The authored fixture decorators specify their complete literal output independently of fallback project generation.
 * @evidence contracts/testing.md#distinguishing-cases CommonJS and ESM inherited options each execute through direct launcher and public preload. The excluded script contrasts with a distinct included source; invalid compile gates have their own test.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry owns four real startup requests, with two distinct module-format roots and two startup protocols per root.
 * @evidence contracts/e2e.md#necessary-boundary The excluded-entry fallback, inherited effective options and public preload/bootstrap must connect to Node. Direct runtime option calculation does not prove either startup protocol can serve the excluded entry.
 * @evidence contracts/e2e.md#shared-execution Two roots share their immutable inputs across direct/preload requests. Both protocols and both module formats remain independent actual startup preparations because those startup connections are the asserted behavior; toolchain artifacts are reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each module format has its own root and public package link; completed processes reset Node module state before the next startup. TestProject retains and later cleans each fixture.
 * @evidence contracts/e2e.md#preserved-coverage All original four success/effect observations remain here. All startup combinations execute before collected assertion failures are thrown.
 */
export function test_ttsx_register_executes_excluded_standard_decorators() {
  const failures: unknown[] = [];
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
      try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
      try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT); } catch (error) { failures.push(error); }
    }
  }

  if (failures.length) throw new AggregateError(failures, "register_executes_excluded_standard_decorators assertions failed");
}
