import assert from "node:assert/strict";

import { selectReferencedProject } from "../../../../../packages/ttsc/src/compiler/internal/project/selectReferencedProject";

/**
 * Verifies referenced ownership follows observed declaration-order DFS.
 *
 * Supplied current identity/membership/reference observations distinguish
 * traversal policy. They do not certify native config resolution, compiler
 * root expansion, missing-file diagnosis, malformed showConfig or ctime retry.
 *
 * 1. Contrast empty references, discovery membership and ordered owners.
 * 2. Traverse nested references and terminate observed aliases/cycles.
 * 3. Change membership between calls and require a fresh lookup.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls the production-used selectReferencedProject and observes literal result spellings and exact observation order, including reuse of supplied discovery references and independent lookups after membership changes.
 * @evidence contracts/testing.md#independent-expectations Authored graph edges, identity aliases and boolean membership inputs define the first owner independently; explicit event lists require discovery-first and depth-first declaration order rather than consulting the selector output.
 * @evidence contracts/testing.md#distinguishing-cases Empty references invoke no observations, discovery wins before references, a first direct owner avoids later nodes, a nested first owner precedes a later sibling, aliases/cycles receive one membership visit, and false observations fall back without poisoning the next call.
 * @evidence contracts/testing.md#execution-ownership One in-process direct unit supplies ordinary supported observations and no native DTO, filesystem, compiler, child or host; observed identity quality and native input capture remain delegated boundaries.
 */
export function test_referenced_project_selection_preserves_observed_depth_first_order(): void {
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const run = (references: readonly string[], children: Record<string, readonly string[]>, owners: ReadonlySet<string>, identities: Record<string, string> = {}) => {
    const events: string[] = [];
    const result = selectReferencedProject("discovered", references, {
      identity(config) { events.push(`identity:${config}`); return identities[config] ?? config; },
      contains(config) { events.push(`contains:${config}`); return owners.has(config); },
      readReferences(config) {
        events.push(`references:${config}`);
        assert.notEqual(config, "discovered", "supplied discovery references must be reused");
        assert.ok(Object.hasOwn(children, config), `authored reference observation: ${config}`);
        return children[config]!;
      },
    });
    return { result, events };
  };
  const rows: readonly {
    name: string; refs: string[]; children: Record<string, readonly string[]>;
    owners: string[]; expected: string; events: string[];
  }[] = [
    { name: "empty references", refs: [], children: {}, owners: ["discovered"], expected: "discovered", events: [] },
    { name: "discovery membership", refs: ["first"], children: {}, owners: ["discovered", "first"], expected: "discovered", events: ["contains:discovered"] },
    { name: "first direct owner", refs: ["first", "second"], children: {}, owners: ["first", "second"], expected: "first", events: ["contains:discovered", "identity:discovered", "identity:first", "contains:first"] },
    { name: "nested owner before later sibling", refs: ["first", "second"], children: { first: ["nested"] }, owners: ["nested", "second"], expected: "nested", events: ["contains:discovered", "identity:discovered", "identity:first", "contains:first", "references:first", "identity:nested", "contains:nested"] },
  ];
  for (const row of rows) check(row.name, () => {
    const before = [...row.refs];
    const actual = run(row.refs, row.children, new Set(row.owners));
    assert.equal(actual.result, row.expected);
    assert.deepEqual(actual.events, row.events);
    assert.deepEqual(row.refs, before);
  });
  check("cycle and physical alias false observations", () => {
    const actual = run(["first", "first-alias", "second"], {
      first: ["discovered-alias", "leaf"], leaf: ["first"], second: [],
    }, new Set(), { "first-alias": "first", "discovered-alias": "discovered" });
    assert.equal(actual.result, "discovered");
    assert.deepEqual(actual.events, [
      "contains:discovered", "identity:discovered", "identity:first", "contains:first", "references:first",
      "identity:discovered-alias", "identity:leaf", "contains:leaf", "references:leaf", "identity:first",
      "identity:first-alias", "identity:second", "contains:second", "references:second",
    ]);
  });
  check("later lookup observes changed membership", () => {
    const refs = ["first", "second"];
    const children = { first: [], second: [] };
    const owners = new Set<string>();
    assert.deepEqual(run(refs, children, owners), { result: "discovered", events: [
      "contains:discovered", "identity:discovered", "identity:first", "contains:first", "references:first",
      "identity:second", "contains:second", "references:second",
    ] });
    owners.add("second");
    assert.deepEqual(run(refs, children, owners), { result: "second", events: [
      "contains:discovered", "identity:discovered", "identity:first", "contains:first", "references:first",
      "identity:second", "contains:second",
    ] });
  });
  if (failures.length) throw new AggregateError(failures, "referenced project ownership policy failed");
}
