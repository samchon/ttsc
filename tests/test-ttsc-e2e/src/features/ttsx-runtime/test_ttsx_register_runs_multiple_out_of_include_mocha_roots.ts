import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MOCHA_BIN,
  TTSX_REGISTER,
  linkTtscPackage,
} from "../../internal/ttsx-register";

/**
 * Verifies ttsx register runs multiple out-of-include Mocha roots.
 *
 * Mocha is a JavaScript host that loads every TypeScript test after the public
 * preload runs. Each excluded test therefore needs its own checked entry emit,
 * and those emits must coexist until Mocha has loaded the complete suite.
 *
 * 1. Create two strict projects whose `include` covers only `src`, not tests.
 * 2. Run real Mocha with three `.ts` tests and `--require ttsc/register`.
 * 3. Assert all pass, every project emit coexists in the workspace cache, and exit
 *    cleans the shared generation directory without creating nested
 *    `node_modules` trees.
 * @evidence contracts/testing.md#behavioral-verification Real Mocha under ttsc/register loads three excluded TS roots from two projects; output must name all suites and 3 passing, the third test observes three live cache generations, and exit leaves the runtime index empty without nested node_modules.
 * @evidence contracts/testing.md#independent-expectations Authored enum/string equality is the execution oracle; exact live count three and post-exit empty list independently observe coexistence and cleanup. The projects source enums are not imported by the generated tests.
 * @evidence contracts/testing.md#distinguishing-cases Two roots share one owning project and the third uses another; all are excluded from src include. The test distinguishes live coexistence from early deletion and post-exit release from leaked generations.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_register_runs_multiple_out_of_include_mocha_roots E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary The public register preload, real Mocha module loading, native root emits and runtime directory ownership must agree across one host. Direct ownership planning cannot prove Mocha keeps all emitted roots usable.
 * @evidence contracts/e2e.md#shared-execution One consumer/link and one Mocha host serve three actual TS test entries and two owning configs. Distinct excluded roots need separate checked emits, but no Mocha process or consumer installation repeats per root.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The third fixture test checks coexistence while the host is live; outer assertions inspect cleanup only after synchronous exit. TestProject owns root/link and runtime owns generation directories.
 * @evidence contracts/e2e.md#preserved-coverage Original status, three suite names, 3 passing, in-host generation count, empty exit index and absent nested node_modules remain. Runtime import of one/src or two/src enums is not an existing assertion.
 */
export function test_ttsx_register_runs_multiple_out_of_include_mocha_roots() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "ttsx-register-mocha",
        type: "commonjs",
        version: "1.0.0",
      }),
      "one/tsconfig.json": projectConfig(),
      "one/src/value.ts": `export enum Value { One = "one" }\n`,
      "one/test/first/index.ts": mochaTest("first", "one"),
      "one/test/second/index.ts": mochaTest("second", "one"),
      "two/tsconfig.json": projectConfig(),
      "two/src/value.ts": `export enum Value { Two = "two" }\n`,
      "two/test/third/index.ts": mochaTest("third", "two", true),
    });
    linkTtscPackage(root);

    const result = TestProject.spawn(
      process.execPath,
      [
        MOCHA_BIN,
        "--require",
        TTSX_REGISTER,
        "--extension",
        "ts",
        "one/test/first/index.ts",
        "one/test/second/index.ts",
        "two/test/third/index.ts",
      ],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /3 passing/);
    for (const suite of ["first", "second", "third"]) {
      assert.match(result.stdout, new RegExp(`\\b${suite}\\b`));
    }
    const runtimeRoot = path.join(
      root,
      "node_modules",
      ".cache",
      "ttsc",
      "ttsx",
      "project",
    );
    assert.deepEqual(
      fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot) : [],
      [],
    );
    for (const project of ["one", "two"]) {
      assert.equal(
        fs.existsSync(path.join(root, project, "node_modules")),
        false,
      );
    }
  }

function projectConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      module: "commonjs",
      outDir: "dist",
      rootDir: "src",
      strict: true,
      target: "ES2022",
    },
    include: ["src"],
  });
}

function mochaTest(
  suite: string,
  expected: string,
  assertCoexistence: boolean = false,
): string {
  const coexistence = !assertCoexistence
    ? ""
    : [
        `    const fs = require("node:fs");`,
        `    const path = require("node:path");`,
        `    const cache = path.join(process.cwd(), "node_modules", ".cache", "ttsc", "ttsx", "project");`,
        `    if (fs.readdirSync(cache).length !== 3) throw new Error("expected three roots in the shared workspace cache");`,
      ].join("\n");
  return [
    `declare function describe(name: string, body: () => void): void;`,
    `declare function it(name: string, body: () => void): void;`,
    `declare function require(name: string): any;`,
    `declare const process: { cwd(): string };`,
    `enum Expected { Value = ${JSON.stringify(expected)} }`,
    `describe(${JSON.stringify(suite)}, () => {`,
    `  it("uses the checked emit", () => {`,
    `    if (Expected.Value !== ${JSON.stringify(expected)}) throw new Error("wrong value");`,
    coexistence,
    `  });`,
    `});`,
    "",
  ].join("\n");
}
