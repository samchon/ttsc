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
 *    target to inherit the selected host's capabilities, retaining an absent
 *    capability declaration when that host has none.
 * 3. Require cycles, a plugin composed by several aggregates, a composed plugin
 *    with its own contributors and malformed aliases to be rejected with their
 *    literal messages.
 *
 * @evidence contracts/testing.md#behavioral-verification composePluginSources is called on a compose-a to compose-b to compose-c chain (sources become source-a, source-a, source-b, input records unchanged, the aggregate returned by identity and the redirected one copied), on aggregate/target pairs whose redirected target inherits only the selected host's capabilities, including absent, empty and explicit false declarations, and on cycle, double-aggregate, target-owned-contributor and malformed-alias inputs that must throw the literal messages.
 * @evidence contracts/testing.md#independent-expectations Expected sources, the shared contributors/capabilities objects and the full error messages are authored literals following the one-hop contract (A.composes=[B] redirects B to A's source without cascading), not values produced by the function under test.
 * @evidence contracts/testing.md#distinguishing-cases Owns nontransitive redirects, name and transform-specifier aliases, inherited contributors/capabilities, absent, empty and explicit false selected-host capabilities against a true target declaration, independent records, reciprocal cycles, conflicting aggregates, invalid targets and forbidden target contributors. Target inputs remain unchanged after each redirected copy.
 * @evidence contracts/testing.md#execution-ownership This named source-unit export invokes the authored pure composition adapter directly with fresh descriptors; no descriptor evaluator, native build or filesystem identity is simulated.
 */
export function test_plugin_composition_preserves_one_hop_host_identity_and_rejections(): void {
  const entries = ["a", "b", "c"].map((name) => ({
    baseDir: "descriptor-base",
    config: { transform: `./plugins/${name}.cjs` },
  }));
  const chain: [ITtscPlugin, ITtscPlugin, ITtscPlugin] = [
    { name: "compose-a", source: "source-a", composes: ["compose-b"] },
    { name: "compose-b", source: "source-b", composes: ["compose-c"] },
    { name: "compose-c", source: "missing-source-c" },
  ];
  const before = structuredClone(chain);
  const result = composePluginSources(entries, chain);
  assert.deepEqual(
    result.map((plugin) => plugin.source),
    ["source-a", "source-a", "source-b"],
  );
  assert.deepEqual(chain, before);
  assert.equal(result[0], chain[0]);
  assert.notEqual(result[1], chain[1]);
  const contributors = [{ name: "demo", source: "contributor-source" }];
  const aggregate: ITtscPlugin = {
    name: "compose-aggregate",
    source: "aggregate-source",
    composes: ["./plugins/b.cjs"],
    contributors,
    capabilities: { emitProvenance: true },
  };
  const target: ITtscPlugin = {
    name: "compose-target",
    source: "missing-target",
    capabilities: { threadingArgs: true, emitProvenance: true },
  };
  const inherited = composePluginSources(entries.slice(0, 2), [
    aggregate,
    target,
  ]);
  assert.equal(inherited.length, 2);
  assert.ok(inherited[1]);
  assert.equal(inherited[1].source, "aggregate-source");
  assert.equal(inherited[1].contributors, contributors);
  assert.equal(inherited[1].capabilities, aggregate.capabilities);
  assert.equal(target.source, "missing-target");
  const capabilityDeclarations: ITtscPlugin["capabilities"][] = [
    undefined,
    {},
    { threadingArgs: false },
  ];
  for (const capabilities of capabilityDeclarations) {
    const selectedHost = { ...aggregate, capabilities };
    const targetBefore = structuredClone(target);
    const redirected = composePluginSources(entries.slice(0, 2), [
      selectedHost,
      target,
    ]);
    assert.equal(redirected.length, 2);
    assert.ok(redirected[1]);
    assert.equal(redirected[1].source, selectedHost.source);
    assert.equal(redirected[1].capabilities, capabilities);
    assert.deepEqual(target, targetBefore);
    assert.notEqual(redirected[1], target);
  }
  assert.throws(
    () =>
      composePluginSources(entries.slice(0, 2), [
        { ...chain[0], composes: ["compose-b"] },
        { ...chain[1], composes: ["compose-a"] },
      ]),
    {
      message:
        'ttsc: plugin composes cycle detected between "compose-a" and "compose-b"; each plugin lists the other in its "composes" array — composition is one hop only, not transitive',
    },
  );
  assert.throws(
    () =>
      composePluginSources(entries, [
        { ...chain[0], composes: ["compose-c"] },
        { ...chain[1], composes: ["compose-c"] },
        chain[2],
      ]),
    {
      message:
        'ttsc: plugin "compose-c" is composed by multiple aggregate plugins; each plugin entry can be redirected to only one aggregate native host',
    },
  );
  assert.throws(
    () =>
      composePluginSources(entries.slice(0, 2), [
        aggregate,
        { ...target, contributors },
      ]),
    {
      message:
        'ttsc: plugin "compose-target" is composed by "compose-aggregate" but declares its own "contributors"; move the contributors onto the aggregate plugin or drop the composes redirect',
    },
  );
  for (const alias of ["", " ", 42]) {
    assert.throws(
      () =>
        composePluginSources(entries.slice(0, 1), [
          { ...aggregate, composes: [alias] as string[] },
        ]),
      {
        message:
          'ttsc: plugin "compose-aggregate" has an invalid "composes" target; targets must be non-empty plugin names or transform specifiers',
      },
    );
  }
  const independent = composePluginSources(entries, [
    { name: "other", source: "untouched" },
  ]);
  assert.deepEqual(independent, [{ name: "other", source: "untouched" }]);
}
