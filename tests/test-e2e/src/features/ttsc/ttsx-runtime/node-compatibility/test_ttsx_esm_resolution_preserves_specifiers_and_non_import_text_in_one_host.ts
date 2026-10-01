import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Verifies ESM resolution and scanner preservation in one emitted project.
 *
 * Independent directories retain each original fixture's authored inputs.
 * The entry catches failures separately so unrelated runtime scenarios run
 * before this test reports its collected assertions.
 *
 * 1. Compile all ESM and source-package fixtures with their shared original options.
 * 2. Import each fixture through the actual runtime hooks in one Node process.
 * 3. Assert each original result and the host's successful exit.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx emit and Node imports execute side-effect, directory-index, URL-suffix and scanner fixtures; each original program result is independently asserted.
 * @evidence contracts/testing.md#independent-expectations Literal outputs follow authored side effects and JavaScript values; query/hash expectations come from the requested suffix, not runtime rewriting.
 * @evidence contracts/testing.md#distinguishing-cases Extensionless imports resolve while extensioned suffix identities and import-shaped strings, templates, comments and regex values remain intact; missing-import rejection remains separately exercised.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry runs public ttsx and sixteen labeled modules; fixture source declarations are program inputs, not hidden test hosts.
 * @evidence contracts/e2e.md#necessary-boundary Compiler emit, Node hooks and ESM loading must agree on original source URLs; parsing alone cannot establish their assembly.
 * @evidence contracts/e2e.md#shared-execution Equivalent ES2022/bundler entry fixtures share one project load, emit, launcher and Node session, including the former identical-profile configured-outDir consumer; disjoint package scopes preserve same-named dependencies, and different dependency-owned compiler inputs retain their necessary builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An explicit fixture-owned cache and untouched dist sentinel isolate cache-versus-deployment effects. A fresh project owns disjoint module paths and scenario-owned side-effect names; same-named fixture packages use distinct fixture versions so TypeScript package-ID deduplication cannot alias different bytes that formerly lived in separate projects; imports occur once and launcher cleanup owns outputs, with no warm-cache transition claimed.
 * @evidence contracts/e2e.md#preserved-coverage The batch retains all original outputs for scanner and suffix preservation, enum forward/reverse values, runtime namespaces, type-only elision, no-rootDir dependencies, ESM/package/MTS classification, source-package directory resolution and original cache-only-run typed module output, dist sentinel bytes, absent dist/main.js and dist/package.json, existing empty per-run cache index after the explicit cache-dir invocation, and original import-meta-preserved asset lookup plus source-only marker and an exact native physical source-file URL (native realpath permits OS aliases such as Windows 8.3 spellings without accepting a cache file); assets alone could remain readable through mirrored cache links; labeled caught imports and aggregated assertions report unrelated failures together.
 */
export function test_ttsx_esm_resolution_preserves_specifiers_and_non_import_text_in_one_host() {
 const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_esm_resolution_preserves_specifiers_and_non_import_text_in_one_host/inputs-1"));
 const cacheDir = path.join(root, ".ttsx-cache");
 const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"], { cwd: root });
 const outputs = result.stdout.trim().split(/\r?\n/);
 const failures: unknown[] = [];
 const cases = [
  {
    "name": "test_ttsx_rewrites_extensionless_esm_side_effect_imports",
    "expected": "side-effect-import-ok",
    "json": false
  },
  {
    "name": "test_ttsx_rewrites_extensionless_esm_directory_index_imports",
    "expected": "directory-index-ok",
    "json": false
  },
  {
    "name": "test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers",
    "expected": {
      "query": "?query",
      "hash": "#hash"
    },
    "json": true
  },
  {
    "name": "test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched",
    "expected": {
      "message": "scanner-ok",
      "dynamic": "dynamic-ok",
      "interpolation": "dynamic-ok",
      "ordinary": "from './helper'",
      "template": "import('./dynamic')",
      "regex": "import\\('\\.\\/helper'\\)"
    },
    "json": true
  },
  {
    "name": "test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir",
    "expected": "Low-2",
    "json": false
  },
  {
    "name": "test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide",
    "expected": "wrapped-7",
    "json": false
  },
  {
    "name": "test_ttsx_preserves_enum_runtime_object_in_a_built_dependency",
    "expected": "Low-2",
    "json": false
  },
  {
    "name": "test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency",
    "expected": "repeated-3",
    "json": false
  },
  {
    "name": "test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module",
    "expected": "loaded-as-module",
    "json": false
  },
  {
    "name": "test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta",
    "expected": "meta-ok",
    "json": false
  },
  {
    "name": "test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs",
    "expected": "side-effect-ran",
    "json": false
  },
  {
    "name": "test_ttsx_runs_a_published_esm_raw_ts_dependency_with_enums_under_node_modules",
    "expected": "painted-red",
    "json": false
  },
  {
    "name": "test_ttsx_runs_a_published_mts_dependency_as_a_module",
    "expected": "mts-module",
    "json": false
  },
  {
    "name": "test_ttsx_resolves_directory_index_imports_in_a_node_modules_raw_ts_dependency",
    "expected": "directory-index-ok",
    "json": false
  },
  {
    "name": "test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path",
    "expected": "esm-runner-ok",
    "json": false
  }
,
  {"name":"test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir","expected":{"asset":"import-meta-preserved","source":"esm-source-relative",sourceUrl:pathToFileURL(TestProject.physicalPath(path.join(root,"src","case15","src","global.ts"))).href},"json":true},
 {"name":"test_runner_corpus_ttsx_keeps_configured_outdir_untouched","expected":"cache-only-run","json":false}
];
 for (const scenario of cases) {
 try {
 const begin = outputs.indexOf("BEGIN:" + scenario.name);
 const end = outputs.indexOf("END:" + scenario.name);
 assert.ok(begin >= 0 && end > begin, scenario.name);
 const value = outputs.slice(begin + 1, end).join("\n");
 const actual = scenario.json ? JSON.parse(value) : value;
 if (scenario.name === "test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir") actual.sourceUrl = pathToFileURL(fs.realpathSync.native(fileURLToPath(actual.sourceUrl))).href;
 assert.deepEqual(actual, scenario.expected, scenario.name);
 } catch (error) { failures.push(error); }
 }
 try { assert.equal(fs.readFileSync(path.join(root, "dist", "keep.txt"), "utf8"), "do-not-delete"); } catch (error) { failures.push(error); }
 try { assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false); } catch (error) { failures.push(error); }
 try { assert.equal(fs.existsSync(path.join(root, "dist", "package.json")), false); } catch (error) { failures.push(error); }
 const projectCache = path.join(cacheDir, "project");
 try { assert.equal(fs.existsSync(projectCache), true); } catch (error) { failures.push(error); }
 try { assert.deepEqual(fs.readdirSync(projectCache), []); } catch (error) { failures.push(error); }
 try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
 if (failures.length) throw new AggregateError(failures, "ESM runtime batch failed");
}
