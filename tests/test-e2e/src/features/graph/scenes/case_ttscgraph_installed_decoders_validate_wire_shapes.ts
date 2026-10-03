import { DUMP_SCHEMA_VERSION } from "@ttsc/graph";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import type { ITtscGraphDump } from "../../../../../../packages/graph/src/structures/ITtscGraphDump";
import type { ITtscGraphSnapshot } from "../../../../../../packages/graph/src/structures/ITtscGraphSnapshot";
import { getIdentityDump } from "../../../internal/graph/internal/identityBoundary";

const require_ = createRequire(import.meta.url);
const lib = path.dirname(require_.resolve("@ttsc/graph"));
const { parseDump } = require_(path.join(lib, "model", "loadGraph.js")) as { parseDump(text: string): ITtscGraphDump };
const { TtscGraphViewSnapshot } = require_(path.join(lib, "TtscGraphViewSnapshot.js")) as { TtscGraphViewSnapshot: { decode(text: string): { ok: true; raw: ITtscGraphDump } | { ok: false; code: 1; diagnostic: string } } };
const { TtscGraphProtocol } = require_(path.join(lib, "model", "TtscGraphProtocol.js")) as { TtscGraphProtocol: { decode(line: string): ITtscGraphSnapshot } };

/**
 * Verifies built workspace validators reject incomplete wire contracts.
 *
 * Source units submit typed envelopes, which cannot establish runtime shape
 * validation. This boundary resolves workspace graph library decoders and a
 * single real native dump, sharing that positive producer input across all
 * independent malformed syntax, version and shape cases.
 *
 * 1. Obtain the shared public CLI dump and accept it in the built library decoders.
 * 2. Reject invalid JSON, stale body schema and malformed current body fields.
 * 3. Reject unknown protocol or malformed envelope fields before typed state admission.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built typia validators accept the native current dump and envelope, then reject all syntax/schema/body/envelope variants with owned framing or unreadable-shape diagnostics. The actual viewer validation owner maps all three dump negatives to code one and one owned diagnostic before reduction.
 * @evidence contracts/testing.md#independent-expectations Literal invalid JSON, body version five, null nodes and wrong id/mode/changed fields independently violate the wire contract; the positive data comes from the real native producer.
 * @evidence contracts/testing.md#distinguishing-cases Syntax, body compatibility, full node-array shape, serve protocol agreement and routing/mode/changed envelope types are separate negatives; their owned prefixes exclude raw TypeGuard and Node stack diagnostics.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, this scene resolves the workspace graph package main in lib and requires its built decoder modules. Their typia calls execute against the real native dump; this is not a consumer-local packed installation or an independent proof of the selected transform binary, build freshness or artifact identity. Authored typed state units do not replace this runtime validation connection.
 * @evidence contracts/e2e.md#necessary-boundary The built parseDump and protocol decoder invoke typia runtime validators on native-produced JSON and literal malformed wire inputs; ordinary untransformed source transpilation does not supply those generated validators. The case preserves this actual built-decoder connection, without certifying a fresh native transform preparation or packed package publication.
 * @evidence contracts/e2e.md#shared-execution One cached real public CLI dump from the identity project supplies both decoder positives and every mutated negative; no fake binary, repeated Go peer build or process-per-shape is used.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each negative clones the immutable original dump/envelope, so stale version or null nodes cannot contaminate a later positive or shared raw producer assertion.
 * @evidence contracts/e2e.md#preserved-coverage Original invalid JSON, schema-v5 and null-node parse rejections remain through their actual decoder, while typed state units preserve downstream retirement/schema semantics; actual viewer HTTP success/lifetime stays in its real viewer boundary. Viewer code-one/diagnostic mapping executes its built workspace decoder owner; real native CLI failure covers the separate process-status connection.
 */
export async function case_ttscgraph_installed_decoders_validate_wire_shapes(): Promise<void> {
  const dump = await getIdentityDump() as ITtscGraphDump;
  const envelope = { id: 1, protocolVersion: 1, mode: "initial", changed: true, capabilities: [], dump };
  assert.deepEqual(parseDump(JSON.stringify(dump)), dump);
  assert.deepEqual(TtscGraphViewSnapshot.decode(JSON.stringify(dump)), { ok: true, raw: dump });
  assert.deepEqual(TtscGraphProtocol.decode(JSON.stringify(envelope)).dump, dump);
  const stale = structuredClone(dump); stale.provenance.schemaVersion = 5;
  const malformed = structuredClone(dump) as unknown as { nodes: unknown }; malformed.nodes = null;
  const cases: [() => unknown, RegExp][] = [
    [() => parseDump("not json"), /dump output is not valid JSON:/u],
    [() => parseDump(JSON.stringify(stale)), new RegExp(`dump is schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}[\\s\\S]*Install a matching \`ttsc\`[\\s\\S]*TTSC_GRAPH_BINARY`, "u")],
    [() => parseDump(JSON.stringify(malformed)), new RegExp(`dump output does not match schema v${String(DUMP_SCHEMA_VERSION)}:[\\s\\S]*nodes`, "u")],
    [() => TtscGraphProtocol.decode("not-json"), /native session returned invalid JSON/u],
    [() => TtscGraphProtocol.decode(JSON.stringify({ protocolVersion: 2 })), /speaks serve protocol v2, this client speaks v1/u],
    [() => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, id: "wrong" })), /unreadable response/u],
    [() => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, mode: true })), /unreadable response/u],
    [() => TtscGraphProtocol.decode(JSON.stringify({ ...envelope, changed: "false" })), /unreadable response/u],
  ];
  const failures: unknown[] = [];
  for (const [run, pattern] of cases) {
    try {
      assert.throws(run, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, pattern);
        assert.equal(error.message.match(/@ttsc\/graph:/gu)?.length, 1);
        assert.doesNotMatch(error.message, /serving the 3D viewer|TypeGuardError|node:/u);
        return true;
      });
    } catch (error) { failures.push(error); }
  }
  for (const [text, pattern] of [
    ["not json", /dump output is not valid JSON:/u],
    [JSON.stringify(stale), new RegExp(`dump is schema v5, this client reads v${String(DUMP_SCHEMA_VERSION)}[\\s\\S]*Install a matching \`ttsc\`[\\s\\S]*TTSC_GRAPH_BINARY`, "u")],
    [JSON.stringify(malformed), new RegExp(`dump output does not match schema v${String(DUMP_SCHEMA_VERSION)}:[\\s\\S]*nodes`, "u")],
  ] as const) {
    try {
      const result = TtscGraphViewSnapshot.decode(text);
      assert.equal(result.ok, false);
      if (result.ok) assert.fail("malformed viewer snapshot was admitted");
      assert.equal(result.code, 1);
      assert.match(result.diagnostic, pattern);
      assert.equal(result.diagnostic.match(/@ttsc\/graph: (?:dump output|ttscgraph dump is schema)/gu)?.length, 1);
      assert.doesNotMatch(result.diagnostic, /serving the 3D viewer|TypeGuardError|node:/u);
    } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "installed decoder negatives failed");
}
