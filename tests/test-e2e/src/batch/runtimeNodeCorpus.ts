import assert from "node:assert/strict";

/**
 * Compare one actual runtime payload with authored module-value literals.
 *
 * This consumer starts no launcher, worker, compiler or process. The shared
 * Runtime entry owns one call to observeNodeCompatibleCorpus and transports its
 * JSON result; separate original compiler profiles and CLI bootstraps are not
 * certified by these in-host values.
 *
 * @evidence contracts/testing.md#behavioral-verification The runtime payload records actual ESM named linking, CommonJS require, a mutual CommonJS cycle, dynamic CJS-to-TSX resolution, extensionless imports, URL suffixes and inert scanner text; the owner compares every named result and reported module failure.
 * @evidence contracts/testing.md#independent-expectations Literal foo/bar/renamed/leaf, combined AB, RESCUED, side-effect/directory markers, query/hash and untouched source-text strings originate in authored modules rather than runtime resolver output.
 * @evidence contracts/testing.md#distinguishing-cases Named and require consumers preserve real star values while seven type/inert names remain absent; mutual cycles and dynamic TSX fallback are separate real graph edges; query/hash and six scanner fields distinguish rewritten module specifiers from unchanged non-import text.
 * @evidence contracts/testing.md#execution-ownership This non-discoverable assertion helper is called by the single shared Runtime E2E entry. Its fixture function observes modules inside that same host and starts no hidden child or additional program.
 * @evidence contracts/e2e.md#necessary-boundary Native module linking consumes actual emitted CommonJS and ESM nodes through the installed runtime hooks; portable export-name or argv functions cannot certify those links.
 * @evidence contracts/e2e.md#shared-execution All eight named observations borrow one immutable NodeNext/ESNext program and one runtime payload without additional preparation, compilation, launcher or worker lifetimes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint fixture paths and one scoped side-effect marker separate the module scenarios. ESM and require deliberately share the immutable star module identity; this is not cold-cache or process-isolation coverage.
 * @evidence contracts/e2e.md#preserved-coverage Original value and inert-name literals are retained at real module edges. Dependency-owned tsconfig variations, distinct entry bootstraps, status/stdout transport, cache cleanup and original project-output observations are outside this helper's coverage.
 */
export function assertRuntimeNodeCorpus(actual: unknown): void {
  assert.ok(actual !== null && typeof actual === "object");
  const payload = actual as { values?: unknown; failures?: unknown };
  assert.ok(payload.values !== null && typeof payload.values === "object");
  const values = payload.values as Record<string, unknown>;
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  check("runtime-node-module-failures", () => assert.deepEqual(payload.failures, []));
  for (const name of ["nested-star-esm", "nested-star-commonjs"])
    check("test_ttsx_exposes_nested_cjs_source_star_exports_to_esm_named_imports/" + name, () =>
      assert.deepEqual(values[name], {
        joined: "foo-ok:bar-ok:renamed-ok:leaf-ok",
        ghosts: [false, false, false, false, false, false, false],
      }),
    );
  check("test_ttsx_runs_a_dependency_with_a_circular_module_graph/runtime-edge", () => assert.equal(values["commonjs-circular-graph"], "combined:AB"));
  check("test_ttsx_commonjs_require_rescues_a_js_specifier_inside_a_dynamic_import", () => assert.deepEqual(values["dynamic-commonjs-tsx-rescue"], { default: "RESCUED" }));
  check("test_ttsx_esm_rewrite_leaves_strings_templates_comments_and_regex_literals_untouched", () => assert.deepEqual(values["scanner-inert-text"], {
    message: "scanner-ok",
    dynamic: "dynamic-ok",
    interpolation: "dynamic-ok",
    ordinary: "from './helper'",
    template: "import('./dynamic')",
    regex: "import\\('\\.\\/helper'\\)",
  }));
  check("test_ttsx_esm_rewrite_preserves_query_and_hash_on_extensioned_specifiers", () => assert.deepEqual(values["query-and-hash"], { query: "?query", hash: "#hash" }));
  check("test_ttsx_rewrites_extensionless_esm_side_effect_imports", () => assert.equal(values["extensionless-side-effect"], "side-effect-import-ok"));
  check("test_ttsx_rewrites_extensionless_esm_directory_index_imports", () => assert.equal(values["extensionless-directory-index"], "directory-index-ok"));
  if (failures.length) throw new AggregateError(failures, "Shared Runtime node corpus assertions failed");
}
