import assert from "node:assert/strict";
import { Session } from "node:inspector/promises";

import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { copyGraphSnapshot } from "../../../../packages/graph/src/model/copyGraphSnapshot";
import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";

/**
 * Verifies each rebuilt file detaches nested facts once at publication.
 *
 * Supported V8 call counters observe actual source operations without replacing
 * the copying API. Counts concern ownership work, with no elapsed-time limit.
 *
 * 1. Construct one frozen file component, then reuse its exact input.
 * 2. Replace its facts and invalidate global metadata separately.
 * 3. Preserve caller aliases, nested freezing and class-member refinement in
 *    resident and cold construction.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public Memory construction is observed through Node Inspector precise call counts: each rebuilt file performs one final snapshot detachment and no mutable-record detachment; exact reuse performs neither. Nested identity, frozen records, literal facts and refinement assertions verify ownership remains intact.
 * @evidence contracts/testing.md#independent-expectations One required publication ownership boundary and zero intermediate mutable DTO boundaries define literal copy counts; authored old/new tag text, variable/property kinds and object identity define isolation independently of synthesis. Counters identify actual named copy operations, not source-text patterns or a timing proxy.
 * @evidence contracts/testing.md#distinguishing-cases Initial resident construction, unchanged reference reuse, changed nested facts, producer-metadata invalidation and mutable cold caller input distinguish reconstruction, reuse and isolation. Existing resident units own multi-file dependency/order, atomic validation, source authority and public mutable ShardStore.apply coverage.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export calls actual model construction in-process through the normal source loader. Node Inspector observes synchronous operations in this sequential suite; finally stops profiling and disconnects the session. No worker, native compiler, installation or build runs.
 */
export async function test_ttscgraph_resident_projection_detaches_nested_facts_once(): Promise<void> {
  const input: ITtscGraphDump = {
    project: "/authored",
    tsconfig: "tsconfig.json",
    provenance: {
      schemaVersion: 8,
      capabilities: ["docTags"],
      producer: { tool: "authored", version: "1", typescript: "none" },
      universe: { configs: [], roots: [] },
      sources: [],
    },
    diagnostics: [],
    nodes: [
      {
        id: "src/one.ts#One:class",
        name: "One",
        kind: "class",
        file: "src/one.ts",
        external: false,
        docTags: [{ name: "tag", text: "old" }],
      },
      {
        id: "src/one.ts#One.value:variable",
        name: "value",
        qualifiedName: "One.value",
        kind: "variable",
        file: "src/one.ts",
        external: false,
        literals: ["1"],
      },
    ],
    edges: [
      {
        from: "src/one.ts#One:class",
        to: "src/one.ts#One.value:variable",
        kind: "accesses",
        evidence: { startLine: 1, startCol: 1, endLine: 1, endCol: 4 },
      },
    ],
  };
  const frozen = copyGraphSnapshot(input);
  const changedInput = structuredClone(input);
  changedInput.nodes[0]!.docTags![0]!.text = "new";
  const changed = copyGraphSnapshot(changedInput);
  const metadata = Object.freeze({
    ...changed,
    provenance: Object.freeze({
      ...changed.provenance,
      producer: Object.freeze({ ...changed.provenance.producer, version: "2" }),
    }),
  });
  const inspector = new Session();
  inspector.connect();
  let enabled = false;
  let started = false;
  const failures: unknown[] = [];
  try {
    await inspector.post("Profiler.enable");
    enabled = true;
    await inspector.post("Profiler.startPreciseCoverage", {
      callCount: true,
      detailed: false,
    });
    started = true;
    const sample = async (
      name: string,
      run: () => TtscGraphMemory,
      copies: number,
    ) => {
      const model = run();
      const coverage = await inspector.post("Profiler.takePreciseCoverage");
      const observed = [
        ["TtscGraphProjection.ts", "create"],
        ["TtscGraphProjection.ts", "full"],
        ["TtscGraphProjection.ts", "synthesize"],
        ["copyGraphSnapshot.ts", "copyGraphSnapshot"],
        ["copyGraphRecords.ts", "copyGraphRecords"],
      ].map(([file, operation]) => {
        const script = coverage.result.find((entry) =>
          entry.url.replaceAll("\\", "/").endsWith("/" + file),
        );
        const fn = script?.functions.find(
          (entry) => entry.functionName === operation,
        );
        return {
          operation,
          scriptId: script?.scriptId,
          url: script?.url,
          functionName: fn?.functionName,
          ranges: fn?.ranges,
          count: fn?.ranges[0]?.count ?? 0,
        };
      });
      console.log(JSON.stringify({ phase: name, functions: observed }));
      try {
        const count = (operation: string): number => {
          const fn = observed.find((entry) => entry.operation === operation)!;
          if (copies !== 0 && operation !== "copyGraphRecords")
            assert.ok(fn.functionName, name + ": operation must be observed");
          return fn.count;
        };
        assert.equal(count("full"), copies);
        assert.equal(count("synthesize"), copies);
        assert.equal(count("copyGraphSnapshot"), copies);
        assert.equal(count("copyGraphRecords"), 0);
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
      return model;
    };
    const first = await sample(
      "initial",
      () => TtscGraphMemory.fromResident(frozen),
      1,
    );
    const second = await sample(
      "unchanged",
      () => TtscGraphMemory.fromResident(frozen, first),
      0,
    );
    const third = await sample(
      "changed facts",
      () => TtscGraphMemory.fromResident(changed, second),
      1,
    );
    const fourth = await sample(
      "metadata",
      () => TtscGraphMemory.fromResident(metadata, third),
      1,
    );
    const cold = await sample(
      "cold caller",
      () => TtscGraphMemory.from(input),
      1,
    );
    const id = input.nodes[0]!.id;
    const member = input.nodes[1]!.id;
    assert.equal(second.node(id), first.node(id));
    assert.notEqual(third.node(id), first.node(id));
    assert.notEqual(fourth.node(id), third.node(id));
    assert.deepEqual(fourth.nodes, third.nodes);
    assert.deepEqual(fourth.edges, third.edges);
    assert.equal(first.node(id)!.docTags![0]!.text, "old");
    assert.equal(third.node(id)!.docTags![0]!.text, "new");
    const assertFrozen = (value: unknown): void => {
      if (value === null || typeof value !== "object") return;
      assert.ok(Object.isFrozen(value));
      for (const child of Object.values(value)) assertFrozen(child);
    };
    for (const [model, source] of [[first, frozen], [cold, input]] as const) {
      assert.equal(model.node(member)!.kind, "property");
      assert.equal(source.nodes[1]!.kind, "variable");
      assert.notEqual(model.node(id)!.docTags, source.nodes[0]!.docTags);
      assert.notEqual(model.node(member)!.literals, source.nodes[1]!.literals);
      assert.notEqual(model.edges[0]!.evidence, source.edges[0]!.evidence);
      assertFrozen(model.nodes);
      assertFrozen(model.edges);
    }
    input.nodes[0]!.docTags![0]!.text = "caller mutation";
    input.nodes[1]!.literals!.push("2");
    input.edges[0]!.evidence!.startLine = 9;
    assert.equal(cold.node(id)!.docTags![0]!.text, "old");
    assert.deepEqual(cold.node(member)!.literals, ["1"]);
    assert.equal(cold.edges[0]!.evidence!.startLine, 1);
    assert.ok(!Object.isFrozen(input.nodes[0]!.docTags![0]));
    assert.ok(!Object.isFrozen(input.nodes[1]!.literals));
    if (failures.length)
      throw new AggregateError(failures, "Resident nested detachment counts");
  } finally {
    try {
      try {
        if (started) await inspector.post("Profiler.stopPreciseCoverage");
      } finally {
        if (enabled) await inspector.post("Profiler.disable");
      }
    } finally {
      inspector.disconnect();
    }
  }
}
