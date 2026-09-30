import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";

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
 * @evidence contracts/e2e.md#shared-execution Equivalent ES2022/bundler entry fixtures share one project load, emit, launcher and Node session; disjoint package scopes preserve same-named dependencies, and different dependency-owned compiler inputs retain their necessary builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A fresh project owns disjoint module paths and scenario-owned side-effect names; same-named fixture packages use distinct fixture versions so TypeScript package-ID deduplication cannot alias different bytes that formerly lived in separate projects; imports occur once and launcher cleanup owns outputs, with no warm-cache transition claimed.
 * @evidence contracts/e2e.md#preserved-coverage The batch retains all original outputs for scanner and suffix preservation, enum forward/reverse values, runtime namespaces, type-only elision, no-rootDir dependencies, ESM/package/MTS classification, source-package directory resolution and original import-meta-preserved asset lookup strengthened with a source-only marker; labeled caught imports and aggregated assertions report unrelated failures together.
 */
export function test_ttsx_esm_resolution_preserves_specifiers_and_non_import_text_in_one_host() {
 const root = TestProject.createProject({
  "src/case0/setup.ts": "\n      export {};\n      declare global { var __ttsxSideEffect: string | undefined; }\n      globalThis.__ttsxSideEffect = \"side-effect-import-ok\";\n    ",
  "src/case0/main.ts": "import \"./setup\";\nconsole.log(globalThis.__ttsxSideEffect);\n",
  "src/case1/pkg/index.ts": "export const message: string = \"directory-index-ok\";\n",
  "src/case1/main.ts": "import { message } from \"./pkg\";\nconsole.log(message);\n",
  "src/case2/helper.ts": "export const href: string = import.meta.url;\n",
  "src/case2/import-url-suffixes.d.ts": "declare module \"*?query\" { export const href: string; }\ndeclare module \"*#hash\" { export const href: string; }\n",
  "src/case2/main.ts": "\n        export {};\n        const query = await import(\"./helper.js?query\");\n        const hash = await import(\"./helper.js#hash\");\n        console.log(JSON.stringify({\n          query: new URL(query.href).search,\n          hash: new URL(hash.href).hash,\n        }));\n      ",
  "src/case3/dynamic.ts": "export const dynamic: string = \"dynamic-ok\";\n",
  "src/case3/helper.ts": "export const message: string = \"scanner-ok\";\n",
  "src/case3/main.ts": "\n      import { message } from \"./helper\";\n      const dynamic = await import(\"./dynamic\");\n      const interpolation = `${(await import(\"./dynamic\")).dynamic}`;\n      const ordinary = \"from './helper'\";\n      const template = `import('./dynamic')`;\n      const regex = /import\\('\\.\\/helper'\\)/;\n      // from './helper'\n      console.log(JSON.stringify({\n        message,\n        dynamic: dynamic.dynamic,\n        interpolation,\n        ordinary,\n        template,\n        regex: regex.source,\n      }));\n    ",
  "package.json": "{\"type\":\"module\",\"private\":true}",
  "tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"ES2022\",\"moduleResolution\":\"bundler\",\"strict\":true,\"outDir\":\"dist\",\"rootDir\":\"src\"},\"include\":[\"src\"]}",
  "src/main.ts": "declare const process: { exitCode: number };\nexport {};\nconsole.log(\"BEGIN:test_ttsx_rewrites_extensionless_esm_side_effect_imports\");\ntry { await import(\"./case0/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_rewrites_extensionless_esm_side_effect_imports\");\nconsole.log(\"BEGIN:test_ttsx_rewrites_extensionless_esm_directory_index_imports\");\ntry { await import(\"./case1/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_rewrites_extensionless_esm_directory_index_imports\");\nconsole.log(\"BEGIN:test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers\");\ntry { await import(\"./case2/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers\");\nconsole.log(\"BEGIN:test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched\");\ntry { await import(\"./case3/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched\");\nconsole.log(\"BEGIN:test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir\");\ntry { await import(\"./case4/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_builds_a_dependency_whose_project_declares_no_rootdir\");\nconsole.log(\"BEGIN:test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide\");\ntry { await import(\"./case5/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_builds_a_raw_ts_dependency_that_type_stripping_cannot_elide\");\nconsole.log(\"BEGIN:test_ttsx_preserves_enum_runtime_object_in_a_built_dependency\");\ntry { await import(\"./case6/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_preserves_enum_runtime_object_in_a_built_dependency\");\nconsole.log(\"BEGIN:test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency\");\ntry { await import(\"./case7/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_preserves_runtime_namespace_value_export_in_a_built_dependency\");\nconsole.log(\"BEGIN:test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module\");\ntry { await import(\"./case8/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_an_esm_package_raw_ts_dependency_as_a_module\");\nconsole.log(\"BEGIN:test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta\");\ntry { await import(\"./case9/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_an_esm_package_raw_ts_dependency_that_uses_import_meta\");\nconsole.log(\"BEGIN:test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs\");\ntry { await import(\"./case10/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_a_commonjs_package_raw_ts_dependency_with_no_module_syntax_as_commonjs\");\nconsole.log(\"BEGIN:test_ttsx_runs_a_published_esm_raw_ts_dependency_with_enums_under_node_modules\");\ntry { await import(\"./case11/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_a_published_esm_raw_ts_dependency_with_enums_under_node_modules\");\nconsole.log(\"BEGIN:test_ttsx_runs_a_published_mts_dependency_as_a_module\");\ntry { await import(\"./case12/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_a_published_mts_dependency_as_a_module\");\nconsole.log(\"BEGIN:test_ttsx_resolves_directory_index_imports_in_a_node_modules_raw_ts_dependency\");\ntry { await import(\"./case13/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_resolves_directory_index_imports_in_a_node_modules_raw_ts_dependency\");\nconsole.log(\"BEGIN:test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path\");\ntry { await import(\"./case14/src/main\"); } catch (error) { console.log(\"FAILED:\" + String(error)); process.exitCode = 1; }\nconsole.log(\"END:test_ttsx_runs_an_esm_typescript_entry_through_the_emitted_project_path\");\nconsole.log(\"BEGIN:test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir\");\ntry { await import(\"./case15/src/main\"); } catch(error) { console.log(\"FAILED:\"+String(error)); process.exitCode=1; }\nconsole.log(\"END:test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir\");\n",
  "src/case4/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case4/node_modules/enum-dep/package.json": "{\"name\":\"enum-dep\",\"version\":\"1.0.4\",\"type\":\"module\",\"exports\":{\".\":\"./src/index.ts\"}}",
  "src/case4/node_modules/enum-dep/tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"ES2022\",\"moduleResolution\":\"bundler\",\"strict\":true},\"include\":[\"src\"]}",
  "src/case4/node_modules/enum-dep/src/level.ts": "export enum Level {\n  Low = 1,\n  High = 2,\n}\n",
  "src/case4/node_modules/enum-dep/src/index.ts": "import { Level } from \"./level\";\nexport const report = (): string => {\n  const forward: number = Level.High;\n  const reverse: string = Level[Level.Low];\n  return reverse + \"-\" + forward;\n};\n",
  "src/case4/src/main.ts": "import { report } from \"enum-dep\";\n\nconsole.log(report());\n",
  "src/case5/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case5/node_modules/built-dep/package.json": "{\"name\":\"built-dep\",\"version\":\"1.0.5\",\"type\":\"module\",\"exports\":{\".\":\"./src/index.ts\"}}",
  "src/case5/node_modules/built-dep/tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"ES2022\",\"moduleResolution\":\"bundler\",\"strict\":true,\"outDir\":\"lib\",\"rootDir\":\"src\"},\"include\":[\"src\"]}",
  "src/case5/node_modules/built-dep/src/brand.ts": "export type Brand<T> = T & { readonly __brand: unique symbol };\nexport namespace Brand {\n  export interface Options {\n    readonly tag: string;\n  }\n}\n",
  "src/case5/node_modules/built-dep/src/index.ts": "import { Brand } from \"./brand\";\nexport const wrap = (value: number): Brand<number> =>\n  value as Brand<number>;\n",
  "src/case5/src/main.ts": "import { wrap } from \"built-dep\";\nconsole.log(\"wrapped-\" + wrap(7));\n",
  "src/case6/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case6/node_modules/enum-dep/package.json": "{\"name\":\"enum-dep\",\"version\":\"1.0.6\",\"type\":\"module\",\"exports\":{\".\":\"./src/index.ts\"}}",
  "src/case6/node_modules/enum-dep/tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"ES2022\",\"moduleResolution\":\"bundler\",\"strict\":true,\"outDir\":\"lib\",\"rootDir\":\"src\"},\"include\":[\"src\"]}",
  "src/case6/node_modules/enum-dep/src/level.ts": "export enum Level {\n  Low = 1,\n  High = 2,\n}\n",
  "src/case6/node_modules/enum-dep/src/index.ts": "import { Level } from \"./level\";\nexport const report = (): string => {\n  const forward: number = Level.High;\n  const reverse: string = Level[Level.Low];\n  return reverse + \"-\" + forward;\n};\n",
  "src/case6/src/main.ts": "import { report } from \"enum-dep\";\nconsole.log(report());\n",
  "src/case7/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case7/node_modules/built-dep/package.json": "{\"name\":\"built-dep\",\"version\":\"1.0.7\",\"type\":\"module\",\"exports\":{\".\":\"./src/index.ts\"}}",
  "src/case7/node_modules/built-dep/tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"ES2022\",\"moduleResolution\":\"bundler\",\"strict\":true,\"outDir\":\"lib\",\"rootDir\":\"src\"},\"include\":[\"src\"]}",
  "src/case7/node_modules/built-dep/src/repeated.ts": "export type ArrayRepeatedNullable<T> = T[] | null;\nexport namespace ArrayRepeatedNullable {\n  export const LABEL: string = \"repeated\";\n  export const of = <T>(...items: T[]): ArrayRepeatedNullable<T> =>\n    items.length === 0 ? null : items;\n}\n",
  "src/case7/node_modules/built-dep/src/index.ts": "import { ArrayRepeatedNullable } from \"./repeated\";\nexport const describe = (): string => {\n  const value = ArrayRepeatedNullable.of(1, 2, 3);\n  const size = value === null ? 0 : value.length;\n  return ArrayRepeatedNullable.LABEL + \"-\" + size;\n};\n",
  "src/case7/src/main.ts": "import { describe } from \"built-dep\";\nconsole.log(describe());\n",
  "src/case8/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case8/node_modules/pub-dep/package.json": "{\"name\":\"pub-dep\",\"version\":\"1.0.8\",\"type\":\"module\",\"exports\":{\".\":\"./index.ts\"}}",
  "src/case8/node_modules/pub-dep/index.ts": "export const detect = (): string => \"loaded-as-module\";\n",
  "src/case8/src/main.ts": "import { detect } from \"pub-dep\";\nconsole.log(detect());\n",
  "src/case9/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case9/node_modules/meta-dep/package.json": "{\"name\":\"meta-dep\",\"version\":\"1.0.9\",\"type\":\"module\",\"exports\":{\".\":\"./effect.ts\"}}",
  "src/case9/node_modules/meta-dep/effect.ts": "const here: string = import.meta.url;\n(globalThis as Record<string, unknown>).__metaDep = here.startsWith(\"file:\")\n  ? \"meta-ok\"\n  : \"meta-bad\";\n",
  "src/case9/src/main.ts": "import \"meta-dep\";\nconsole.log((globalThis as Record<string, unknown>).__metaDep);\n",
  "src/case10/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case10/node_modules/se-dep/package.json": "{\"name\":\"se-dep\",\"version\":\"1.0.10\",\"exports\":{\".\":\"./effect.ts\"}}",
  "src/case10/node_modules/se-dep/effect.ts": "const tag: string = \"side-effect-ran\";\n(globalThis as Record<string, unknown>).__seDep = tag;\n",
  "src/case10/src/main.ts": "import \"se-dep\";\nconsole.log((globalThis as Record<string, unknown>).__seDep);\n",
  "src/case11/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case11/node_modules/pub-dep/package.json": "{\"name\":\"pub-dep\",\"version\":\"1.0.11\",\"type\":\"module\",\"exports\":{\".\":\"./src/index.ts\"}}",
  "src/case11/node_modules/pub-dep/src/index.ts": "import { Color } from \"./color\";\nexport const paint = (): string => `painted-${Color.Red}`;\n",
  "src/case11/node_modules/pub-dep/src/color.ts": "export enum Color {\n  Red = \"red\",\n  Blue = \"blue\",\n}\n",
  "src/case11/src/main.ts": "import { paint } from \"pub-dep\";\nconsole.log(paint());\n",
  "src/case12/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case12/node_modules/mts-dep/package.json": "{\"name\":\"mts-dep\",\"version\":\"1.0.12\",\"exports\":{\".\":\"./index.mts\"}}",
  "src/case12/node_modules/mts-dep/index.mts": "export const fromMts = (): string => \"mts-module\";\n",
  "src/case12/src/main.ts": "import { fromMts } from \"mts-dep\";\nconsole.log(fromMts());\n",
  "src/case13/package.json": "{\"type\":\"module\",\"private\":true}",
  "src/case13/node_modules/idx-dep/package.json": "{\"name\":\"idx-dep\",\"version\":\"1.0.13\",\"type\":\"module\",\"exports\":{\".\":\"./index.ts\"}}",
  "src/case13/node_modules/idx-dep/index.ts": "import { deep } from \"./sub\";\nexport const fromIdx = (): string => deep();\n",
  "src/case13/node_modules/idx-dep/sub/index.ts": "export const deep = (): string => \"directory-index-ok\";\n",
  "src/case13/src/main.ts": "import { fromIdx } from \"idx-dep\";\nconsole.log(fromIdx());\n",
  "src/case14/package.json": "{\"type\":\"module\"}",
  "src/case14/src/helper.ts": "export const message: string = \"esm-runner-ok\";\n",
  "src/case14/src/main.ts": "import { message } from \"./helper\";\nconsole.log(message);\n"
,
  "src/case15/src/node.d.ts": "declare module \"node:fs\" { export function readFileSync(file: string | URL, encoding: string): string; }\ndeclare module \"node:path\" { export function dirname(file: string): string; export function resolve(...parts: string[]): string; }\ndeclare module \"node:url\" { export function fileURLToPath(url: string): string; }\n",
  "src/case15/src/global.ts": "import path from \"node:path\";\nimport { fileURLToPath } from \"node:url\";\nexport const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), \"..\");\nexport const sourceOnly = new URL(\"./marker.txt\", import.meta.url);\n",
  "src/case15/src/main.ts": "import fs from \"node:fs\";\nimport { ROOT, sourceOnly } from \"./global\";\nconsole.log(JSON.stringify({ asset: fs.readFileSync(ROOT + \"/template/data.txt\", \"utf8\"), source: fs.readFileSync(sourceOnly, \"utf8\") }));\n",
  "src/case15/src/marker.txt": "esm-source-relative",
  "src/case15/template/data.txt": "import-meta-preserved"
});
 const result = TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], { cwd: root });
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
  {"name":"test_runner_corpus_esm_import_meta_url_resolves_from_configured_outdir","expected":{"asset":"import-meta-preserved","source":"esm-source-relative"},"json":true}
];
 for (const scenario of cases) {
 try {
 const begin = outputs.indexOf("BEGIN:" + scenario.name);
 const end = outputs.indexOf("END:" + scenario.name);
 assert.ok(begin >= 0 && end > begin, scenario.name);
 const value = outputs.slice(begin + 1, end).join("\n");
 assert.deepEqual(scenario.json ? JSON.parse(value) : value, scenario.expected, scenario.name);
 } catch (error) { failures.push(error); }
 }
 try { assert.equal(result.status, 0, result.stderr); } catch (error) { failures.push(error); }
 if (failures.length) throw new AggregateError(failures, "ESM runtime batch failed");
}
