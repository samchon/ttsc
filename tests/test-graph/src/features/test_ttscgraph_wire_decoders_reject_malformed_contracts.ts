import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscGraphDump } from "../../../../packages/graph/src/structures/ITtscGraphDump";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";

/**
 * Verifies wire decoders reject malformed contracts before consuming facts.
 *
 * These portable decisions run the actual compiled graph operations in this
 * process. Their typia guards come from the common graph build preparation;
 * untransformed source transpilation cannot provide those generated guards.
 * The authored empty dump is a schema control, not a native-produced snapshot
 * or a certificate of producer, build freshness or artifact identity.
 *
 * 1. Load the prepared decoder modules and accept an authored schema-eight dump
 *    and serve-one envelope in the dump, protocol and viewer decoders.
 * 2. Reject eight independent syntax, schema, body and envelope variants with
 *    their owned diagnostics, preserving each scenario's failure identity.
 * 3. Map the three dump negatives to viewer code one, with one owned prefix and
 *    no internal guard, Node or viewer-serving diagnostic.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual parseDump, TtscGraphProtocol.decode and TtscGraphViewSnapshot.decode accept the authored valid dump/envelope. Eight malformed wire cases throw owned errors; the viewer maps invalid JSON, schema five and null nodes to ok false, code one and an owned diagnostic, before reduction or HTTP startup.
 * @evidence contracts/testing.md#independent-expectations The empty dump and envelope are authored from the schema-eight and serve-one type contracts, not native output or decoder-generated data. Literal invalid JSON, schema five, null nodes, protocol two and wrong id/mode/changed types violate those contracts independently. Diagnostic patterns and forbidden internal/banner strings are authored literals; the current-version text in messages follows the decoder's exported version constant rather than independently pinning that constant.
 * @evidence contracts/testing.md#distinguishing-cases Three schema-positive decoder results contrast three dump negatives and five protocol negatives: invalid JSON, protocol disagreement and wrong id, mode or changed types. Every negative requires exactly one owned prefix and excludes TypeGuardError, node: and serving-the-viewer text. Viewer failures additionally require code one; all independent scenarios are collected even if another fails.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit entry calls the graph build's actual decoder operations in-process with authored strings. The common preparation must supply graph lib with generated typia guards; this entry performs no build, new compiler Program, installation, native process, consumer or host startup. Actual native wire production/loading remains owned by the E2E graph boundary and is not certified here.
 */
export function test_ttscgraph_wire_decoders_reject_malformed_contracts(): void {
  const require_ = createRequire(import.meta.url);
  const lib = path.dirname(require_.resolve("@ttsc/graph"));
  const { DUMP_SCHEMA_VERSION, parseDump } = require_(path.join(lib, "model", "loadGraph.js")) as {
    DUMP_SCHEMA_VERSION: number;
    parseDump(text: string): ITtscGraphDump;
  };
  const { TtscGraphProtocol } = require_(path.join(lib, "model", "TtscGraphProtocol.js")) as {
    TtscGraphProtocol: { decode(line: string): ITtscGraphSnapshot };
  };
  const { TtscGraphViewSnapshot } = require_(path.join(lib, "TtscGraphViewSnapshot.js")) as {
    TtscGraphViewSnapshot: {
      decode(text: string): { ok: true; raw: ITtscGraphDump } | { ok: false; code: 1; diagnostic: string };
    };
  };
  const dump: ITtscGraphDump = {
    project: "/fixture",
    tsconfig: "tsconfig.json",
    provenance: {
      schemaVersion: 8,
      capabilities: [],
      producer: { tool: "authored-schema-input", version: "", typescript: "" },
      universe: { configs: [], roots: [] },
      sources: [],
    },
    nodes: [],
    edges: [],
    diagnostics: [],
  };
  const envelope: ITtscGraphSnapshot = { id: 1, protocolVersion: 1, mode: "initial", changed: true, capabilities: [], dump };
  const stale = structuredClone(dump);
  stale.provenance.schemaVersion = 5;
  const malformed = { ...dump, nodes: null };
  const stalePattern = new RegExp(`dump is schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}[\\s\\S]*Install a matching \`ttsc\`[\\s\\S]*TTSC_GRAPH_BINARY`, "u");
  const bodyPattern = new RegExp(`dump output does not match schema v${String(DUMP_SCHEMA_VERSION)}:[\\s\\S]*nodes`, "u");
  const failures: unknown[] = [];
  for (const [label, run] of [
    ["valid dump", () => assert.deepEqual(parseDump(JSON.stringify(dump)), dump)],
    ["valid protocol envelope", () => assert.deepEqual(TtscGraphProtocol.decode(JSON.stringify(envelope)), envelope)],
    ["valid viewer snapshot", () => assert.deepEqual(TtscGraphViewSnapshot.decode(JSON.stringify(dump)), { ok: true, raw: dump })],
  ] as const) {
    try { run(); } catch (error) { failures.push(new Error(label, { cause: error })); }
  }
  const negatives: [string, () => unknown, RegExp][] = [
    ["dump invalid JSON", () => parseDump("not json"), /dump output is not valid JSON:/u],
    ["dump stale schema", () => parseDump(JSON.stringify(stale)), stalePattern],
    ["dump null nodes", () => parseDump(JSON.stringify(malformed)), bodyPattern],
    ["protocol invalid JSON", () => TtscGraphProtocol.decode("not-json"), /native session returned invalid JSON/u],
    ["protocol version two", () => TtscGraphProtocol.decode('{"protocolVersion":2}'), /speaks serve protocol v2, this client speaks v1/u],
    ["protocol string id", () => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, id: "wrong" })), /unreadable response/u],
    ["protocol boolean mode", () => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, mode: true })), /unreadable response/u],
    ["protocol string changed", () => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, changed: "false" })), /unreadable response/u],
  ];
  for (const [label, run, pattern] of negatives) {
    try {
      assert.throws(run, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, pattern);
        assert.equal(error.message.match(/@ttsc\/graph:/gu)?.length, 1);
        assert.doesNotMatch(error.message, /serving the 3D viewer|TypeGuardError|node:/u);
        return true;
      });
    } catch (error) { failures.push(new Error(label, { cause: error })); }
  }
  for (const [label, text, pattern] of [
    ["viewer invalid JSON", "not json", /dump output is not valid JSON:/u],
    ["viewer stale schema", JSON.stringify(stale), stalePattern],
    ["viewer null nodes", JSON.stringify(malformed), bodyPattern],
  ] as const) {
    try {
      const result = TtscGraphViewSnapshot.decode(text);
      assert.equal(result.ok, false);
      if (result.ok) assert.fail("malformed viewer snapshot was admitted");
      assert.equal(result.code, 1);
      assert.match(result.diagnostic, pattern);
      assert.equal(result.diagnostic.match(/@ttsc\/graph: (?:dump output|ttscgraph dump is schema)/gu)?.length, 1);
      assert.doesNotMatch(result.diagnostic, /serving the 3D viewer|TypeGuardError|node:/u);
    } catch (error) { failures.push(new Error(label, { cause: error })); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "wire decoder contract scenarios failed");
}
