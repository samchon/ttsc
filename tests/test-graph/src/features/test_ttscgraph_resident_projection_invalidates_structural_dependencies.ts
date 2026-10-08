import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { TtscGraphMemory } from "../../../../packages/graph/src/model/TtscGraphMemory";
import { TtscGraphShardStore } from "../../../../packages/graph/src/model/TtscGraphShardStore";
import type { ITtscGraphSnapshot } from "../../../../packages/graph/src/structures/ITtscGraphSnapshot";
/**
 * Verifies resident reuse invalidates complete structural dependencies.
 *
 * A retained raw member is insufficient when its same-file owners or source-module export anchor change.
 *
 * 1. Project a class/member, barrel cross-edge, artifact parent and unrelated source.
 * 2. Change merged owner ambiguity and artifact containment, then remove an export; compare full projection.
 * 3. Delete/rename sources and change universe metadata, preserving unrelated reuse only when its dependencies still qualify.
 *
 * @evidence contracts/testing.md#behavioral-verification Real component synthesis preserves the initial module export anchor and changes property refinement, exact dotted owner containment, artifact parents and export deletion while complete nodes/edges/indexes equal fresh full construction.
 * @evidence contracts/testing.md#independent-expectations Literal owner IDs, file containment after ambiguous handles, module-to-file export anchor, artifact parent and deleted-node absence define expected answers independently of reuse.
 * @evidence contracts/testing.md#distinguishing-cases Same-file merged class/interface collision, quoted dotted member, bracket member, cross-file exports, artifact metadata, deletion/rename and broad universe invalidation.
 * @evidence contracts/testing.md#execution-ownership The matching source-unit export calls actual shard validation and model projection with explicitly authored protocol inputs in-process; no worker, compiler, native host, install or build runs. Computed fixture hashes qualify inputs but do not independently prove digest encoding.
 */

export function test_ttscgraph_resident_projection_invalidates_structural_dependencies(): void {
 const left=shard("src/left.ts","Box"),right=shard("src/right.ts","Right"),stable=shard("src/stable.ts","Stable");
 left.nodes=[{id:"src/left.ts#Box:class",name:"Box",kind:"class",file:left.key,external:false},
 {id:'src/left.ts#Box.a.b:variable',name:'a.b',qualifiedName:'Box.a.b',kind:'variable',file:left.key,external:false},
 {id:'src/left.ts#Box["x.y"]:variable',name:'x.y',qualifiedName:'Box["x.y"]',kind:'variable',file:left.key,external:false},
 {id:"src/left.ts#module:module",name:"module",kind:"module",file:left.key,external:false}];
 left.edges=[{from:left.nodes[3]!.id,to:right.nodes[0]!.id,kind:"exports"}];
 const metadata:Shard={key:"metadata",nodes:[{id:"docs/a.md#part",name:"Part",kind:"markdown_section",file:"docs/a.md",external:false,parent:"docs/a.md"}],edges:[],diagnostics:[]};
 const population=[left,right,stable,metadata],store=new TtscGraphShardStore(),fullStore=new TtscGraphShardStore();
 let tx=transaction(population,1),model=project(store,tx);equivalent(model,TtscGraphMemory.from(fullStore.apply(tx)));
 assert.equal(model.node(left.nodes[1]!.id)!.kind,"property");assert.equal(model.incoming(left.nodes[1]!.id).find(e=>e.kind==="contains")!.from,left.nodes[0]!.id);
 assert.equal(model.node(left.nodes[2]!.id)!.kind,"property");assert.equal(model.outgoing(left.key).find(e=>e.kind==="exports")!.to,right.nodes[0]!.id);
 const old=model,changed=structuredClone(left);changed.nodes.push({id:"src/left.ts#Box:interface",name:"Box",kind:"interface",file:left.key,external:false});population[0]=changed;
 const next=transaction(population,2,tx,[changed]);model=project(store,next,model);equivalent(model,TtscGraphMemory.from(fullStore.apply(next)));tx=next;
 assert.equal(model.node(left.nodes[1]!.id)!.kind,"variable");assert.equal(model.incoming(left.nodes[1]!.id).find(e=>e.kind==="contains")!.from,left.key);
 assert.equal(old.node(left.nodes[1]!.id)!.kind,"property");assert.equal(model.node(stable.nodes[0]!.id),old.node(stable.nodes[0]!.id));
 const artifact=structuredClone(metadata);artifact.nodes[0]!.parent="docs/new.md";population[3]=artifact;
 const artifactTx=transaction(population,3,tx,[artifact]),beforeArtifact=model;model=project(store,artifactTx,model);equivalent(model,TtscGraphMemory.from(fullStore.apply(artifactTx)));tx=artifactTx;
 assert.equal(model.incoming(artifact.nodes[0]!.id)[0]!.from,"docs/new.md");assert.equal(model.node(stable.nodes[0]!.id),beforeArtifact.node(stable.nodes[0]!.id));
 const noEdge=structuredClone(changed);noEdge.edges=[];population[0]=noEdge;population.splice(1,1);
 const deleteTx=transaction(population,4,tx,[noEdge],[right.key]),beforeDelete=model;model=project(store,deleteTx,model);equivalent(model,TtscGraphMemory.from(fullStore.apply(deleteTx)));tx=deleteTx;
 assert.equal(model.node(right.nodes[0]!.id),undefined);assert.equal(model.node(stable.nodes[0]!.id),beforeDelete.node(stable.nodes[0]!.id));
 const renamed=shard("src/renamed.ts","Right");population.push(renamed);
 const renameTx=transaction(population,5,tx,[renamed]);model=project(store,renameTx,model);equivalent(model,TtscGraphMemory.from(fullStore.apply(renameTx)));tx=renameTx;
 const universeTx=transaction(population,6,tx,[]);universeTx.universe.roots=[{file:"src/renamed.ts",config:"tsconfig.json"}];universeTx.generation=generation(universeTx);
 const beforeUniverse=model;model=project(store,universeTx,model);equivalent(model,TtscGraphMemory.from(fullStore.apply(universeTx)));assert.notEqual(model.node(stable.nodes[0]!.id),beforeUniverse.node(stable.nodes[0]!.id));
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
function equivalent(actual: TtscGraphMemory, full: TtscGraphMemory): void {
  assert.deepEqual(actual.nodes,full.nodes);assert.deepEqual(actual.edges,full.edges);
  for(const node of full.nodes){assert.deepEqual(actual.node(node.id),node);assert.deepEqual(actual.named(node.name),full.named(node.name));assert.deepEqual(actual.symbols(node.qualifiedName??node.name),full.symbols(node.qualifiedName??node.name));assert.deepEqual(actual.incoming(node.id),full.incoming(node.id));assert.deepEqual(actual.outgoing(node.id),full.outgoing(node.id));}
  for(const target of ["docs/spec.md#Left","docs/spec.md#Right","docs/spec.md#Stable"])assert.deepEqual(actual.citing(target),full.citing(target));
}
