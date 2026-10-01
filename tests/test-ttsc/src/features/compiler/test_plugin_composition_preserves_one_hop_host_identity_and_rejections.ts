import assert from "node:assert/strict";

import { composePluginSources } from "../../../../../packages/ttsc/src/plugin/internal/load/composePluginSources";
import type { ITtscPlugin } from "../../../../../packages/ttsc/src/structures/ITtscPlugin";

/**
 * Verifies composition's actual descriptor decisions without Go producers.
 *
 * Source redirection is one hop over the original records. Contributor and
 * capability inheritance determine the later native host identity, so direct
 * descriptor assertions distinguish incorrect decisions before compiling.
 *
 * 1. Compose a three-plugin chain and require redirection to be one hop over
 *    unchanged input records.
 * 2. Compose an aggregate carrying contributors and capabilities and require the
 *    target to inherit them, falling back to its own capabilities when the
 *    aggregate has none.
 * 3. Require cycles, a plugin composed by several aggregates, a composed plugin
 *    with its own contributors and malformed aliases to be rejected with their
 *    literal messages.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls production composePluginSources with the original A-to-B-to-C, aggregate/target and reciprocal-cycle shapes; checks exact source/contributor/capability records, nonmutation and original complete rejection messages.
 * @evidence contracts/testing.md#independent-expectations Literal A/B/C source identities and exact diagnostics establish expected results; the target suffix and source-missing counterexample remain in one real contributor-redirect E2E.
 * @evidence contracts/testing.md#distinguishing-cases Owns nontransitive redirects, name and transform-specifier aliases, inherited contributors/capabilities, absent-capability fallback, independent records, reciprocal cycles, conflicting aggregates, invalid targets and forbidden target contributors.
 * @evidence contracts/testing.md#execution-ownership This named source-unit export invokes the authored pure composition adapter directly with fresh descriptors; no descriptor evaluator, native build or filesystem identity is simulated.
 */
export function test_plugin_composition_preserves_one_hop_host_identity_and_rejections(): void {
  const entries = ["a", "b", "c"].map((name) => ({
    baseDir: "descriptor-base", config: { transform: `./plugins/${name}.cjs` },
  }));
  const chain: [ITtscPlugin, ITtscPlugin, ITtscPlugin] = [
    { name: "compose-a", source: "source-a", composes: ["compose-b"] },
    { name: "compose-b", source: "source-b", composes: ["compose-c"] },
    { name: "compose-c", source: "missing-source-c" },
  ];
  const before = structuredClone(chain);
  const result = composePluginSources(entries, chain);
  assert.deepEqual(result.map((plugin) => plugin.source), ["source-a", "source-a", "source-b"]);
  assert.deepEqual(chain, before);
  assert.equal(result[0], chain[0]);
  assert.notEqual(result[1], chain[1]);
  const contributors = [{ name: "demo", source: "contributor-source" }];
  const aggregate: ITtscPlugin = {
    name: "compose-aggregate", source: "aggregate-source",
    composes: ["./plugins/b.cjs"], contributors,
    capabilities: { emitProvenance: true },
  };
  const target: ITtscPlugin = { name: "compose-target", source: "missing-target", capabilities: { threadingArgs: true } };
  const inherited = composePluginSources(entries.slice(0, 2), [aggregate, target]);
  assert.equal(inherited.length, 2);
  assert.ok(inherited[1]);
  assert.equal(inherited[1].source, "aggregate-source");
  assert.equal(inherited[1].contributors, contributors);
  assert.equal(inherited[1].capabilities, aggregate.capabilities);
  assert.equal(target.source, "missing-target");
  const fallback = composePluginSources(entries.slice(0, 2), [{ ...aggregate, capabilities: undefined }, target]);
  assert.equal(fallback.length, 2);
  assert.ok(fallback[1]);
  assert.equal(fallback[1].capabilities, target.capabilities);
  assert.throws(() => composePluginSources(entries.slice(0, 2), [
    { ...chain[0], composes: ["compose-b"] },
    { ...chain[1], composes: ["compose-a"] },
  ]), { message: 'ttsc: plugin composes cycle detected between "compose-a" and "compose-b"; each plugin lists the other in its "composes" array — composition is one hop only, not transitive' });
  assert.throws(() => composePluginSources(entries, [
    { ...chain[0], composes: ["compose-c"] },
    { ...chain[1], composes: ["compose-c"] },
    chain[2],
  ]), { message: 'ttsc: plugin "compose-c" is composed by multiple aggregate plugins; each plugin entry can be redirected to only one aggregate native host' });
  assert.throws(() => composePluginSources(entries.slice(0, 2), [aggregate, { ...target, contributors }]), {
    message: 'ttsc: plugin "compose-target" is composed by "compose-aggregate" but declares its own "contributors"; move the contributors onto the aggregate plugin or drop the composes redirect',
  });
  for (const alias of ["", " ", 42]) {
    assert.throws(() => composePluginSources(entries.slice(0, 1), [
      { ...aggregate, composes: [alias] as string[] },
    ]), { message: 'ttsc: plugin "compose-aggregate" has an invalid "composes" target; targets must be non-empty plugin names or transform specifiers' });
  }
  const independent = composePluginSources(entries, [{ name: "other", source: "untouched" }]);
  assert.deepEqual(independent, [{ name: "other", source: "untouched" }]);
}
