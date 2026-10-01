import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  STANDARD_DECORATOR_OUTPUT,
  STANDARD_DECORATOR_SOURCE,
} from "../../../internal/ttsc/internal/ttsx-decorators";

/**
 * Verifies ttsx executes standard decorators at ESNext in both module formats.
 *
 * #1359 compiles successfully but gives Node preserved decorator syntax. The
 * runtime must lower it while ordinary builds retain their configured target.
 *
 * 1. Build the reported class/method example with ordinary ttsc.
 * 2. Run ttsx for ESNext, CommonJS, and NodeNext extension overrides.
 * 3. Assert decorator effects and unchanged source, config, and published emit.
 * @evidence contracts/testing.md#behavioral-verification Ordinary ttsc emit must retain decorators, while ttsx executes their complete effects and preserves the published output, original source and config bytes.
 * @evidence contracts/testing.md#independent-expectations The authored class/method decorators specify STANDARD_DECORATOR_OUTPUT. A literal decorator token distinguishes ordinary ESNext preservation, and pre-run byte snapshots independently establish nonmutation.
 * @evidence contracts/testing.md#distinguishing-cases ESNext and CommonJS .ts plus NodeNext .mts and .cts distinguish module and extension-selected entry assembly. Compiler-only target semantics also have Go/VM unit owners.
 * @evidence contracts/testing.md#execution-ownership One named E2E entry owns four real ordinary-build/runtime pairs. The sources are consumer inputs, and every iteration has its own extension/module identity.
 * @evidence contracts/e2e.md#necessary-boundary Public ordinary compiler output and transient launcher output must remain separate while Node loads each supported entry format. A library emission unit does not establish published-output preservation across runtime preparation.
 * @evidence contracts/e2e.md#shared-execution Each module/extension pair needs its own ordinary output and runtime entry preparation to observe preservation under that entry format; within the pair one immutable workspace serves both commands. Shipped toolchain builds are reused.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each format has a separate tracked root; source/config/output snapshots survive until the synchronous runtime command completes. No published output is rewritten between its capture and comparison.
 * @evidence contracts/e2e.md#preserved-coverage All original four format successes, exact decoration effects, ordinary decorator preservation and three byte-preservation assertions remain. Assertion failures are collected across every format before AggregateError. A missing ordinary artifact still blocks its dependent preservation comparison.
 */
export function test_ttsx_executes_standard_decorators_at_esnext() {
  const failures: unknown[] = [];
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
    try { assert.equal(built.status, 0, built.stderr); } catch (error) { failures.push(error); }
    const output = path.join(
      root,
      "dist",
      `main.${extension === "mts" ? "mjs" : extension === "cts" ? "cjs" : "js"}`,
    );
    const emitted = fs.readFileSync(output, "utf8");
    try { assert.match(emitted, /@sayHelloClass/); } catch (error) { failures.push(error); }
    const result = TestProject.spawn(TestProject.TTSX_BIN, [entry], {
      cwd: root,
    });
    try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
    try { assert.equal(result.stdout.trim(), STANDARD_DECORATOR_OUTPUT); } catch (error) { failures.push(error); }
    try { assert.equal(fs.readFileSync(output, "utf8"), emitted); } catch (error) { failures.push(error); }
    try { assert.equal(
      fs.readFileSync(path.join(root, "tsconfig.json"), "utf8"),
      config,
    ); } catch (error) { failures.push(error); }
    try { assert.equal(
      fs.readFileSync(path.join(root, entry), "utf8"),
      STANDARD_DECORATOR_SOURCE,
    ); } catch (error) { failures.push(error); }
  }

  if (failures.length) throw new AggregateError(failures, "executes_standard_decorators_at_esnext assertions failed");
}
