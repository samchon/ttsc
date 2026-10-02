import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FixtureFiles } from "../../../../internal/FixtureFiles";

/**
 * Verifies ESM resolution and scanner preservation in one emitted project.
 *
 * Labeled source modules retain each original fixture's authored inputs, while
 * dependency consumers share the same package tree and owning compiler
 * profiles. The entry catches failures separately so unrelated runtime
 * scenarios run before this test reports its collected assertions.
 *
 * 1. Compile all ESM and source-package fixtures with their shared original
 *    options.
 * 2. Import each fixture through the actual runtime hooks in one Node process.
 * 3. Assert each original result and the host's successful exit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx emit and Node imports execute side-effect, directory-index, URL-suffix and scanner fixtures plus explicit TypeScript-extension imports, a published CTS export assignment and an MTS entry resolving an MJS specifier; each authored result is independently asserted.
 * @evidence contracts/testing.md#independent-expectations Literal outputs follow authored side effects and JavaScript values; query/hash expectations come from the requested suffix, not runtime rewriting.
 * @evidence contracts/testing.md#distinguishing-cases Extensionless imports resolve while extensioned suffix identities and import-shaped strings, templates, comments and regex values remain intact; missing-import rejection remains separately exercised.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry runs public ttsx and twenty-one labeled modules; fixture source declarations are program inputs, not hidden test hosts.
 * @evidence contracts/e2e.md#necessary-boundary Compiler emit, Node hooks and ESM loading must agree on original source URLs; parsing alone cannot establish their assembly.
 * @evidence contracts/e2e.md#shared-execution Equivalent ES2022/bundler entry fixtures share one project load, emit, launcher and Node session. The enum and type-only-elision plus runtime-namespace consumers now use two central dependency-owned programs instead of four repeated package programs; the enum owner retains absent rootDir/outDir, and the built owner retains explicit rootDir/outDir and owns the configured enum, type-only elision and runtime namespace together. Raw packages without owning configs remain raw inputs to the runtime lowering path.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An explicit fixture-owned cache and untouched dist sentinel isolate cache-versus-deployment effects. A fresh project owns disjoint consumer module paths and scenario-owned side-effect names; each central package has one manifest and one immutable source identity, and the formerly different pub-dep packages have distinct pub-dep and paint-dep names so package-ID deduplication cannot alias unrelated bytes; imports occur once and launcher cleanup owns outputs, with no warm-cache transition claimed.
 * @evidence contracts/e2e.md#preserved-coverage The batch retains all original outputs for scanner and suffix preservation, enum forward/reverse values under both absent and explicit rootDir/outDir profiles, runtime namespaces, type-only elision, no-rootDir dependencies, ESM/package/MTS classification, source-package directory resolution and original cache-only-run typed module output, dist sentinel bytes, absent dist/main.js and dist/package.json, existing empty per-run cache index after the explicit cache-dir invocation, and original import-meta-preserved asset lookup plus source-only marker and an exact native physical source-file URL (native realpath permits OS aliases such as Windows 8.3 spellings without accepting a cache file); assets alone could remain readable through mirrored cache links; The additional allow-ts-extension-ok, cts-commonjs and mts-runner-ok literals run in the same host; The standalone extension-import and CTS entries are removed because their original ES2022/bundler options and literal runtime values execute here; the original NodeNext MTS and CommonJS suppression entries remain until their distinct emitter profiles have verified shared owners. Labeled caught imports and aggregated assertions report unrelated failures together.
 */
export function test_ttsx_esm_resolution_preserves_specifiers_and_non_import_text_in_one_host() {
  const root = TestProject.createProject(
    FixtureFiles.read(
      "ttsc/ttsx_esm_resolution_preserves_specifiers_and_non_import_text_in_one_host/inputs-1",
    ),
  );
  const cacheDir = path.join(root, ".ttsx-cache");
  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    [
      "--cwd",
      root,
      "--cache-dir",
      cacheDir,
      "--noEmit",
      "--emitDeclarationOnly",
      "--declaration",
      "src/main.mts",
    ],
    { cwd: root },
  );
  const outputs = result.stdout.trim().split(/\r?\n/);
  const failures: unknown[] = [];
  const cases = [
    {
      name: "ttsx rewrites extensionless esm side effect imports",
      expected: "side-effect-import-ok",
      json: false,
    },
    {
      name: "ttsx rewrites extensionless esm directory index imports",
      expected: "directory-index-ok",
      json: false,
    },
    {
      name: "ttsx esm rewrite preserves query and hash on extensioned specifiers",
      expected: {
        query: "?query",
        hash: "#hash",
      },
      json: true,
    },
    {
      name: "ttsx esm rewrite leaves strings templates comments and regex literals untouched",
      expected: {
        message: "scanner-ok",
        dynamic: "dynamic-ok",
        interpolation: "dynamic-ok",
        ordinary: "from './helper'",
        template: "import('./dynamic')",
        regex: "import\\('\\.\\/helper'\\)",
      },
      json: true,
    },
    {
      name: "ttsx builds a dependency whose project declares no rootdir",
      expected: "Low-2",
      json: false,
    },
    {
      name: "ttsx builds a raw ts dependency that type stripping cannot elide",
      expected: "wrapped-7",
      json: false,
    },
    {
      name: "ttsx preserves enum runtime object in a built dependency",
      expected: "Low-2",
      json: false,
    },
    {
      name: "ttsx preserves runtime namespace value export in a built dependency",
      expected: "repeated-3",
      json: false,
    },
    {
      name: "ttsx runs an esm package raw ts dependency as a module",
      expected: "loaded-as-module",
      json: false,
    },
    {
      name: "ttsx runs an esm package raw ts dependency that uses import meta",
      expected: "meta-ok",
      json: false,
    },
    {
      name: "ttsx runs a commonjs package raw ts dependency with no module syntax as commonjs",
      expected: "side-effect-ran",
      json: false,
    },
    {
      name: "ttsx runs a published esm raw ts dependency with enums under node modules",
      expected: "painted-red",
      json: false,
    },
    {
      name: "ttsx runs a published mts dependency as a module",
      expected: "mts-module",
      json: false,
    },
    {
      name: "ttsx resolves directory index imports in a node modules raw ts dependency",
      expected: "directory-index-ok",
      json: false,
    },
    {
      name: "ttsx runs an esm typescript entry through the emitted project path",
      expected: "esm-runner-ok",
      json: false,
    },
    {
      name: "runner corpus esm import meta url resolves from configured outdir",
      expected: {
        asset: "import-meta-preserved",
        source: "esm-source-relative",
        sourceUrl: pathToFileURL(
          TestProject.physicalPath(
            path.join(root, "src", "case15", "src", "global.ts"),
          ),
        ).href,
      },
      json: true,
    },
    {
      name: "runner corpus ttsx keeps configured outdir untouched",
      expected: "cache-only-run",
      json: false,
    },
    {
      name: "ttsx runs allow importing ts extensions project",
      expected: "allow-ts-extension-ok",
      json: false,
    },
    {
      name: "ttsx runs a published cts dependency as commonjs",
      expected: "cts-commonjs",
      json: false,
    },
    {
      name: "test_ttsx_runs_an_mts_entry_and_resolves_emitted_mjs_imports",
      expected: "mts-runner-ok",
      json: false,
    },
    {
      name: "test_ttsx_runs_the_entry_when_emit_suppressing_flags_are_forwarded",
      expected: "entry-ran",
      json: false,
    },
  ];
  for (const scenario of cases) {
    try {
      const begin = outputs.indexOf("BEGIN:" + scenario.name);
      const end = outputs.indexOf("END:" + scenario.name);
      assert.ok(begin >= 0 && end > begin, scenario.name);
      const value = outputs.slice(begin + 1, end).join("\n");
      const actual = scenario.json ? JSON.parse(value) : value;
      if (
        scenario.name ===
        "runner corpus esm import meta url resolves from configured outdir"
      )
        actual.sourceUrl = pathToFileURL(
          fs.realpathSync.native(fileURLToPath(actual.sourceUrl)),
        ).href;
      assert.deepEqual(actual, scenario.expected, scenario.name);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    assert.equal(
      fs.readFileSync(path.join(root, "dist", "keep.txt"), "utf8"),
      "do-not-delete",
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.equal(fs.existsSync(path.join(root, "dist", "package.json")), false);
  } catch (error) {
    failures.push(error);
  }
  const projectCache = path.join(cacheDir, "project");
  try {
    assert.equal(fs.existsSync(projectCache), true);
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.deepEqual(fs.readdirSync(projectCache), []);
  } catch (error) {
    failures.push(error);
  }
  try {
    assert.equal(result.status, 0, result.stderr);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length)
    throw new AggregateError(failures, "ESM runtime batch failed");
}
