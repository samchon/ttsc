import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { TtscGraphShardStore } from "../../../../packages/graph/src/model/TtscGraphShardStore";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";
import fs from "node:fs";
import path from "node:path";
import { TestProject } from "../../../utils/src/TestProject";
/**
 * Verifies fact reuse never transfers previous source-read authority.
 *
 * Immutable source adjudication is scoped to a model, including cached failures; equivalent nodes do not qualify live bytes.
 *
 * 1. Read and cache original source lines and an absent manifest member.
 * 2. Create another generation reusing those facts after bytes or presence change.
 * 3. Require fresh digest adjudication, then update provenance and preserve old snapshot answers.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source readers distinguish old cached lines/absence from each new model reader even when its projected nodes are reused. Updated digest authority permits only the new source bytes.
 * @evidence contracts/testing.md#independent-expectations Literal old/new disk bytes, independently hashed UTF-8 source witnesses and authored missing-file presence define readable/absent results.
 * @evidence contracts/testing.md#distinguishing-cases Successful cached read, stale disk mismatch, cached missing source later created, unrelated delta retaining nodes, and updated source provenance.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export calls actual shard validation and model projection with explicitly authored protocol inputs in-process; no worker, compiler, native host, install or build runs. Computed fixture hashes qualify inputs but do not independently prove digest encoding.
 */

export function test_ttscgraph_resident_projection_preserves_source_authority(): void {
 const root=TestProject.tmpdir("graph-resident-source-authority-");fs.mkdirSync(path.join(root,"src"));
 const text="export const value = 1;\n",updated="export const value = 2;\n",file="src/stable.ts",missingFile="src/missing.ts";
 fs.writeFileSync(path.join(root,file),text);
 const stable=shard(file,"Stable"),missing=shard(missingFile,"Missing"),other=shard("src/other.ts","Other");
 const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
 stable.source={file,checkerDigest:digest(text),diskDigest:digest(text)};missing.source={file:missingFile,checkerDigest:digest(text),diskDigest:digest(text)};
 const inputs=[stable,missing,other],store=new TtscGraphShardStore();
 const initial=transaction(inputs,1);initial.project=root;
 const first=project(store,initial);assert.deepEqual(first.source.lines(file),text.split("\n"));assert.equal(first.source.lines(missingFile),undefined);
 fs.writeFileSync(path.join(root,file),updated);fs.writeFileSync(path.join(root,missingFile),text);
 const change=structuredClone(other);change.nodes[0]!.signature="(): number";inputs[2]=change;
 const delta=transaction(inputs,2,initial,[change]);delta.project=root;const second=project(store,delta,first);
 assert.equal(second.node(stable.nodes[0]!.id),first.node(stable.nodes[0]!.id));assert.notEqual(second.source,first.source);
 assert.equal(second.source.lines(file),undefined);assert.deepEqual(second.source.lines(missingFile),text.split("\n"));
 assert.deepEqual(first.source.lines(file),text.split("\n"));assert.equal(first.source.lines(missingFile),undefined);
 const changed=structuredClone(stable);changed.source={file,checkerDigest:digest(updated),diskDigest:digest(updated)};inputs[0]=changed;
 const next=transaction(inputs,3,delta,[changed]);next.project=root;const third=project(store,next,second);
 assert.deepEqual(third.source.lines(file),updated.split("\n"));assert.equal(second.source.lines(file),undefined);assert.deepEqual(first.source.lines(file),text.split("\n"));
}

type Shard = ITtscGraphSnapshot.IShard;
function transaction(shards: Shard[], sequence: number, previous?: ITtscGraphSnapshot.ITransaction, changed = shards, deletes: string[] = []): ITtscGraphSnapshot.ITransaction {
  const manifest = shards.map((shard) => ({ key: shard.key, digest: TtscGraphShardStore.shardDigest(shard) })).sort((a,b) => Buffer.compare(Buffer.from(a.key),Buffer.from(b.key)));
  const fields = { tsconfig: "tsconfig.json", producer: { tool: "authored-consumer-contract", version: "1", typescript: "no compiler" }, capabilities: ["sourceDigests", "diskDigests", "docTags"], universe: { configs: [], roots: [] }, manifest };
  return { protocolVersion: 1, schemaVersion: 8, project: "/fixture", ...fields, sequence, generation: generation(fields), upserts: changed.map((shard) => ({ shard, digest: TtscGraphShardStore.shardDigest(shard) })), deletes, ...(previous === undefined ? {} : { baseSequence: previous.sequence, baseGeneration: previous.generation }) };
}
function generation(value: Pick<ITtscGraphSnapshot.ITransaction,"tsconfig"|"producer"|"capabilities"|"universe"|"manifest">): string {
  return createHash("sha256").update(JSON.stringify({ tsconfig:value.tsconfig,producer:value.producer,capabilities:value.capabilities,universe:value.universe,manifest:value.manifest })).digest("hex");
}
function shard(file: string, name: string): Shard {
  return { key: file, source: { file, checkerDigest: "0".repeat(64), diskDigest: "0".repeat(64) }, nodes: [{ id: file+"#"+name+":function",name,kind:"function",file,external:false,signature:"(): void",docTags:[{name:"evidence",text:"docs/spec.md#"+name}] }], edges: [], diagnostics: [] };
}
function project(store: TtscGraphShardStore, input: ITtscGraphSnapshot.ITransaction, previous?: TtscGraphMemory): TtscGraphMemory {
  return store.applyProjection(input, (dump) => TtscGraphMemory.fromResident(dump, previous));
}
