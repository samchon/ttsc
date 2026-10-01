import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TTSX_REGISTER, linkTtscPackage } from "../../../internal/ttsc/internal/ttsx-register";

/**
 * Verifies ttsx register stops diagnostics before entry effects.
 *
 * Installing the private runtime hook alone would compile a newly discovered
 * source through the dependency lane, whose diagnostics are deliberately
 * skipped. The public preload must instead establish the same checked entry
 * gate as the ttsx CLI before any user statement can execute.
 *
 * 1. Create an included entry with a type error before a marker write.
 * 2. Assert the diagnostic, absent marker, and cleaned runtime directory.
 * 3. Repeat through a JS host with same-basename out-of-include roots, proving the
 *    first root's stem-matched emit cannot hide the second's diagnostic.
 * @evidence contracts/testing.md#behavioral-verification Uses public ttsc/register for an included bad entry and a later excluded bad entry after FIRST, requiring diagnostics before marker effects.
 * @evidence contracts/testing.md#independent-expectations Authored string/number errors, FIRST and missing marker files independently establish gating and execution order.
 * @evidence contracts/testing.md#distinguishing-cases The first fixture checks empty project cache; the second checks a successful earlier entry followed by failure but does not assert cache emptiness.
 * @evidence contracts/testing.md#execution-ownership This second runtime review entry is the named E2E export test_ttsx_register_stops_diagnostics_before_entry_effects at this path, selected by tests/test-e2e/evidence.config.json; no direct-source unit equivalence is inferred without comparing its assertions.
 * @evidence contracts/e2e.md#necessary-boundary Two real Node preload hosts connect public registration, native checking and suppression of entry effects.
 * @evidence contracts/e2e.md#shared-execution Both cases reuse the installed public register package and compiler; each requires its own project and process because their startup states differ.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Temporary marker paths are fixture-owned, package links are local, and synchronous child completion precedes marker/cache inspection.
 * @evidence contracts/e2e.md#preserved-coverage All diagnostic, status, ordering and marker assertions remain here, with cleanup scope limited to the first fixture.
 */
export function test_ttsx_register_stops_diagnostics_before_entry_effects() {
  const root = TestProject.commonJsProject(FixtureFiles.read("ttsc/ttsx_register_stops_diagnostics_before_entry_effects/inputs-1"));
  linkTtscPackage(root);
  const marker = path.join(root, "executed.txt");
  const cacheDir = path.join(root, "node_modules", ".cache", "ttsc", "ttsx");

  const result = TestProject.spawn(
    process.execPath,
    ["--require", TTSX_REGISTER, "src/main.ts"],
    {
      cwd: root,
      env: {
        TTSX_REGISTER_MARKER: marker,
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /project check failed/);
  assert.match(
    result.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
  assert.equal(fs.existsSync(marker), false);
  const runtimeRoot = path.join(cacheDir, "project");
  assert.deepEqual(
    fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot) : [],
    [],
  );

  const repeatedRoot = TestProject.createProject({
    "host.cjs": [
      `require("./test/first/index.ts");`,
      `require("./test/second/index.ts");`,
      "",
    ].join("\n"),
    "package.json": JSON.stringify({ type: "commonjs" }),
    "src/value.ts": `export const value = "included";\n`,
    "test/first/index.ts": `console.log("FIRST");\n`,
    "test/second/index.ts": [
      `import fs from "node:fs";`,
      `const invalid: string = 123;`,
      `fs.writeFileSync(process.env.TTSX_REGISTER_MARKER!, invalid);`,
      "",
    ].join("\n"),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        outDir: "dist",
        rootDir: "src",
        strict: true,
        target: "ES2022",
      },
      include: ["src"],
    }),
  });
  linkTtscPackage(repeatedRoot);
  const repeatedMarker = path.join(repeatedRoot, "executed.txt");
  const repeated = TestProject.spawn(
    process.execPath,
    ["--require", TTSX_REGISTER, "host.cjs"],
    {
      cwd: repeatedRoot,
      env: { TTSX_REGISTER_MARKER: repeatedMarker },
    },
  );
  assert.notEqual(repeated.status, 0);
  assert.equal(repeated.stdout.trim(), "FIRST");
  assert.match(repeated.stderr, /entry check failed/);
  assert.match(
    repeated.stderr,
    /Type 'number' is not assignable to type 'string'/,
  );
  assert.equal(fs.existsSync(repeatedMarker), false);
}
