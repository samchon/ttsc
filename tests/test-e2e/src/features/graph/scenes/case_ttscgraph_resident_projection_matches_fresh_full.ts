import { loadGraph } from "@ttsc/graph";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { ITtscGraphSnapshot } from "../../../../../../packages/graph/src/structures/ITtscGraphSnapshot";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import { installedTargetBoundary } from "../../../internal/graph/internal/installedTargetBoundary";

type Model = ReturnType<typeof loadGraph>;
const require_ = createRequire(import.meta.url);
const lib = path.dirname(require_.resolve("@ttsc/graph"));
const { TtscGraphSessionState } = require_(path.join(lib, "model/TtscGraphSessionState.js")) as typeof import("../../../../../../packages/graph/lib/model/TtscGraphSessionState");
const { TtscGraphLinePeer } = require_(path.join(lib, "model/TtscGraphLinePeer.js")) as typeof import("../../../../../../packages/graph/lib/model/TtscGraphLinePeer");
const { TtscGraphNativeArguments } = require_(path.join(lib, "model/TtscGraphNativeArguments.js")) as typeof import("../../../../../../packages/graph/lib/model/TtscGraphNativeArguments");
const { TtscGraphProtocol } = require_(path.join(lib, "model/TtscGraphProtocol.js")) as typeof import("../../../../../../packages/graph/lib/model/TtscGraphProtocol");

/**
 * Verifies resident projection reuse against fresh real native full snapshots.
 *
 * Authored transaction units cannot establish the checker/delta/runtime
 * connection. This small multi-file project uses the same unmodified native
 * binary for the built resident state owner and each independent public full load.
 *
 * 1. Load initial and unchanged facts, then apply body and public API edits.
 * 2. Delete, rename and change config/root membership, comparing every fact and
 *    query with a fresh full load while retaining old immutable answers.
 * 3. Join the original resident owner before restoring any shared source bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resident-state graph and public loadGraph calls compare complete nodes/edges, every exact id/name/symbol/relation/citation query, exported facts and source authority. Native validated frames establish initial/unchanged/incremental/reload and full manifest/upsert/delete evidence; unchanged file facts/buckets retain identity during small edits.
 * @evidence contracts/testing.md#independent-expectations Literal authored class/member, cross-file barrel/import, deletion/rename and independent-root controls define expected presence and signatures. A separately executed native dump and cold model provide the complete semantic oracle; explicit reference assertions distinguish allocation without timing thresholds.
 * @evidence contracts/testing.md#distinguishing-cases Initial/no-op, body versus API edit, deleted source, renamed source with barrel update, config reload, root membership change, retained old models and independently adjudicated current source bytes.
 * @evidence contracts/testing.md#execution-ownership The Graph batch explicitly calls this scene. Workspace-built resident state, LinePeer, argv builder and generated decoder use the installed target's actual unmodified binary through the existing Host injection boundary. Its decoder callback retains each actual validated frame without replacing foreign exports or internals or fabricating producer responses. The no-publisher Host owns no SDK sidecars; the existing batch covers facade discovery separately.
 * @evidence contracts/e2e.md#necessary-boundary Only real serve/dump processes connect native shard deltas, generated decoding, resident projection and cold full construction. Authored source units separately own malformed transactions and artifact-only dependency cases.
 * @evidence contracts/e2e.md#shared-execution One upfront small fixture population borrows the existing installed target and binary. One resident producer spans all phases; one fresh dump per phase is necessary for the independent full oracle, with no additional install, Go build, packed SDK or compiler modification.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A dedicated config selects only upfront fixture sources, independent of the target's original profile. Each mutation follows the preceding completed graph/full observations. Finally awaits session close and verifies its original peer is no longer alive before restoring original bytes; unknown closure retains inputs and withdraws target reuse. Assertion, close and restoration failures remain aggregate members.
 * @evidence contracts/e2e.md#preserved-coverage Adds the actual native oracle for four resident-projection source units without removing any existing Graph batch assertions. No-op identity, old frozen snapshots, real source authority and wider reload distinctions remain explicit here.
 */
export async function case_ttscgraph_resident_projection_matches_fresh_full(): Promise<void> {
  const target = installedTargetBoundary();
  const directory = path.join(target.root, "projection-oracle");
  const originals = FixtureFiles.read(
    "graph/ttscgraph_resident_projection_matches_fresh_full/inputs-1",
  );
  assert.equal(fs.existsSync(directory), false, "oracle population must be new");
  fs.mkdirSync(directory);
  for (const [file, text] of Object.entries(originals))
    fs.writeFileSync(path.join(directory, file), text);
  const tsconfig = "projection-oracle/tsconfig.json";
  const config = JSON.parse(originals["tsconfig.json"]!) as {
    compilerOptions: { strict: boolean; [key: string]: unknown };
    files: string[];
  };
  const write = (file: string, text: string): void => {
    fs.writeFileSync(path.join(directory, file), text);
  };
  const configure = (): void => write("tsconfig.json", JSON.stringify(config));
  const frames: ITtscGraphSnapshot[] = [];
  const receiptFile = path.join(
    process.env.TTSC_E2E_TRACE ?? target.root,
    "projection-oracle-receipt.jsonl",
  );
  let peer: ReturnType<typeof TtscGraphLinePeer.open> | undefined;
  const session = new TtscGraphSessionState({
    open(events) {
      assert.equal(peer, undefined, "one native resident must span the oracle");
      return (peer = TtscGraphLinePeer.open(
        target.binary,
        TtscGraphNativeArguments.serve(target.root, tsconfig, null),
        events,
        { stderr: "capture" },
      ));
    },
    decode(line) {
      const frame = TtscGraphProtocol.decode(line);
      frames.push(frame);
      return frame;
    },
    beforeRequest: async () => {},
    artifacts: () => "",
    close: async () => {},
  });
  const retained: Array<{ model: Model; facts: string; lines: readonly string[] | undefined }> = [];
  const failures: unknown[] = [];
  let blocked = false;
  let previous: Model | undefined;
  let stableId: string | undefined;
  const observe = async (phase: string, mode: ITtscGraphSnapshot.Mode): Promise<Model> => {
    const before = frames.length;
    let graph: Model;
    try {
      graph = await session.graph();
    } catch (error) {
      // A failed native request can precede its retirement acknowledgment.
      // Later mutations lose authority until finally joins this original peer.
      blocked = true;
      throw error;
    }
    assert.equal(frames.length, before + 1, phase + " must observe one actual native frame");
    const frame = frames.at(-1)!;
    fs.appendFileSync(receiptFile, JSON.stringify({ phase, frame }) + "\n");
    assert.equal(frame.mode, mode, phase);
    assert.equal(frame.error, undefined, phase);
    if (mode === "unchanged") {
      assert.equal(graph, previous);
      assert.equal(frame.snapshot, undefined);
    } else {
      assert.ok(frame.snapshot, phase + " requires an actual shard frame");
      assert.ok(frame.snapshot.manifest.length > 1);
      if (previous !== undefined) assert.ok(frame.snapshot.baseSequence !== undefined);
    }
    const full = loadGraph({ cwd: target.root, tsconfig, binary: target.binary });
    equalModel(graph, full);
    for (const old of retained) {
      assert.equal(JSON.stringify(answers(old.model)), old.facts);
      assert.equal(old.model.source.lines("projection-oracle/model.ts"), old.lines);
    }
    if (phase === "initial") {
      stableId = graph.named("UnrelatedStableControl")[0]!.id;
      assert.equal(graph.named("Model").filter((node) => node.kind === "class").length, 1);
      assert.ok(graph.edges.some((edge) => edge.kind === "exports" && edge.from === "projection-oracle/barrel.ts"));
      assert.ok(graph.edges.some((edge) => edge.kind === "calls"));
    }
    if (mode === "incremental" && previous !== undefined) {
      assert.equal(graph.node(stableId!), previous.node(stableId!));
      assert.equal(graph.named("UnrelatedStableControl"), previous.named("UnrelatedStableControl"));
      assert.equal(graph.outgoing("projection-oracle/stable.ts"), previous.outgoing("projection-oracle/stable.ts"));
      assert.equal(graph.citing("docs/stable.md#control"), previous.citing("docs/stable.md#control"));
      assert.ok(frame.snapshot!.upserts.length < frame.snapshot!.manifest.length, "small edit must retain native shards");
    }
    retained.push({ model: graph, facts: JSON.stringify(answers(graph)), lines: graph.source.lines("projection-oracle/model.ts") });
    previous = graph;
    return graph;
  };
  const phases: Array<[string, () => Promise<void>]> = [
    ["initial", async () => { await observe("initial", "initial"); }],
    ["no-op", async () => { await observe("no-op", "unchanged"); }],
    ["body edit", async () => {
      write("model.ts", originals["model.ts"]!.replace("return this.value;", "return this.value + 1;"));
      const body = await observe("body edit", "incremental");
      assert.equal(body.named("read")[0]!.signature?.includes("number"), true);
    }],
    ["API edit", async () => {
      write("model.ts", originals["model.ts"]!.replace("read(): number { return this.value; }", 'read(): string { return String(this.value); }'));
      write("consumer.ts", originals["consumer.ts"]!.replace(": number", ": string"));
      const api = await observe("API edit", "incremental");
      assert.equal(api.named("read")[0]!.signature?.includes("string"), true);
    }],
    ["delete", async () => {
      fs.unlinkSync(path.join(directory, "removed.ts"));
      config.files = config.files.filter((file) => file !== "removed.ts");
      configure();
      const deleted = await observe("delete", "reload");
      assert.equal(deleted.named("RemovedControl").length, 0);
      assert.ok(frames.at(-1)!.snapshot!.deletes.some((key) => key.includes("removed.ts")));
    }],
    ["rename", async () => {
      write("renamed.ts", fs.readFileSync(path.join(directory, "model.ts"), "utf8"));
      fs.unlinkSync(path.join(directory, "model.ts"));
      write("barrel.ts", originals["barrel.ts"]!.replace('"./model"', '"./renamed"'));
      config.files = config.files.map((file) => file === "model.ts" ? "renamed.ts" : file);
      configure();
      const renamed = await observe("rename", "reload");
      assert.equal(renamed.nodes.some((node) => node.file === "projection-oracle/model.ts"), false);
      assert.equal(renamed.named("Model")[0]!.file, "projection-oracle/renamed.ts");
    }],
    ["configuration", async () => {
      config.compilerOptions.strict = false;
      configure();
      await observe("configuration", "reload");
    }],
    ["root membership", async () => {
      config.files.push("independent.ts");
      configure();
      const roots = await observe("root membership", "reload");
      assert.equal(roots.named("IndependentRootControl").length, 1);
    }],
  ];
  try {
    for (const [phase, run] of phases) {
      if (blocked) {
        failures.push(new Error(phase + " blocked by unresolved prior native request"));
        continue;
      }
      try {
        await run();
      } catch (error) {
        failures.push(new Error(phase, { cause: error }));
      }
    }
  } finally {
    let released = false;
    try {
      await session.close();
      assert.equal(peer?.alive() ?? false, false, "original resident child must join");
      released = true;
    } catch (error) {
      failures.push(error);
      try {
        target.retainUnjoined("Projection oracle resident closure was not established");
      } catch (retentionError) {
        failures.push(retentionError);
      }
    }
    if (released) {
      try {
        for (const [file, text] of Object.entries(originals)) write(file, text);
      } catch (error) {
        failures.push(error);
        target.preventReuse("Projection oracle source restoration failed");
      }
    }
    try {
      fs.appendFileSync(receiptFile, JSON.stringify({ event: "retirement", released, peerAlive: peer?.alive() ?? false }) + "\n");
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Resident projection/full native oracle failed");
}

/** Compare complete current answers and independently derived source witnesses. */
function equalModel(actual: Model, full: Model): void {
  assert.deepEqual(actual.nodes, full.nodes);
  assert.deepEqual(actual.edges, full.edges);
  assert.deepEqual(actual.exported(), full.exported());
  for (const node of full.nodes) {
    assert.deepEqual(actual.node(node.id), node);
    assert.deepEqual(actual.named(node.name), full.named(node.name));
    for (const handle of [node.name, node.qualifiedName].filter((x): x is string => x !== undefined))
      assert.deepEqual(actual.symbols(handle), full.symbols(handle));
    assert.deepEqual(actual.incoming(node.id), full.incoming(node.id));
    assert.deepEqual(actual.outgoing(node.id), full.outgoing(node.id));
  }
  for (const target of ["docs/model.md#model", "docs/model.md#read", "docs/stable.md#control"])
    assert.deepEqual(actual.citing(target), full.citing(target));
  const source = (model: Model) => (model.source as unknown as { digests: ReadonlyMap<string, unknown> }).digests;
  assert.deepEqual([...source(actual)], [...source(full)]);
  for (const file of source(full).keys()) assert.deepEqual(actual.source.lines(file), full.source.lines(file));
}

/** Retain query answers by value so later assertions cannot share a mutated index. */
function answers(model: Model) {
  return {
    nodes: model.nodes,
    edges: model.edges,
    exported: model.exported(),
    queries: model.nodes.map((node) => ({
      id: model.node(node.id),
      named: model.named(node.name),
      symbols: model.symbols(node.qualifiedName ?? node.name),
      incoming: model.incoming(node.id),
      outgoing: model.outgoing(node.id),
    })),
    citations: ["docs/model.md#model", "docs/model.md#read", "docs/stable.md#control"].map((target) => model.citing(target)),
  };
}
