import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type TraceMeasurements, readE2eTraceMeasurements } from "../internal/readE2eTraceMeasurements";
import { BatchWorkspace } from "./BatchWorkspace";

type Observe = (traces: TraceMeasurements, location: string, rules: Readonly<Record<string, string>>, dependencies: (value: unknown) => void) => void;
type Dependency = { path: string; kind: string; scope: string; identityStable: boolean; digest: string };
type State = ReturnType<typeof createState>;
const states = new WeakMap<BatchWorkspace.Workspace, State>();

/**
 * Connects one shared resolver graph to the existing typed and warning CLIs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual completed loader payloads retain literal rule values and exact file/directory/optional-file watch versus cache provenance. Later package, helper, candidate and link changes must refresh the same authored entries.
 * @evidence contracts/testing.md#independent-expectations Static module literals and prescribed paths, kinds, scopes and absent branches define the oracle; no expected dependency is derived from the returned graph.
 * @evidence contracts/testing.md#distinguishing-cases CJS/MJS/typed conditions, package metadata versus implementation, local versus package reachability, extension/main fallback, failed recovery and lexical link/query changes retain separate assertions.
 * @evidence contracts/testing.md#execution-ownership The selected esbuild native config corpus calls this before its two existing real CLIs. Their raw evaluator assertions bind child outcomes and payload bytes; the existing resident child later completes the remaining ordered transitions.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node/ttsx module resolution must return both the selected severity and cache/watch metadata. Pure cache and typed-anchor Go units retain internal policy ownership.
 * @evidence contracts/e2e.md#shared-execution One authored subtree borrows the existing installed root, producers and two CLI results. It creates no CLI, installation, prepare or server. Two later project-inputs requests reuse the existing normal resident child; nested evaluator work and configuration reload cost remain real.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The common root is the existing native lint root, preserving the donor common-root containment boundary. Owned new names are absent before copying; symlink and literal-name distinctions require actual admission. Closed CLI boundaries precede mutation and completed resident requests precede restoration.
 * @evidence contracts/e2e.md#preserved-coverage Transfers TestScriptConfigLoaderTracksLocalDependencyGraph's shared setup, actual module values and exact dependency oracles. The actual TS carrier owns these runtime transitions; ordinary Go units retain internal cache and generated module/compiler-anchor policy without substituting for Node/ttsx evaluation.
 */
export function scriptConfigGraphCorpus(workspace: BatchWorkspace.Workspace, traceRoot: string, observe: Observe): State {
  assert.equal(states.has(workspace), false);
  const state = createState(workspace, traceRoot, observe);
  states.set(workspace, state);
  return state;
}

function createState(workspace: BatchWorkspace.Workspace, traceRoot: string, observe: Observe) {
  const root = path.join(workspace.root, "tools/native-lint-config");
  const template = path.join(root, "script-graph");
  const target = (name: string) => path.join(root, name.replace(/^configs(?=\/|$)/, "script-graph-configs").replace(/^shared(?=\/|$)/, "script-graph-shared"));
  const errors: unknown[] = [];
  let initialAccepted = false;
  let changedAccepted = false;
  const write = (name: string, text: string): void => { fs.mkdirSync(path.dirname(target(name)), {recursive:true}); fs.writeFileSync(target(name), text); };
  const physical = (location: string): string => {
    const original=path.resolve(location);let current=original;const missing:string[]=[];
    for(;;) {
      try { return path.join(fs.realpathSync.native(current),...missing); }
      catch { const parent=path.dirname(current);if(parent===current)return original;missing.unshift(path.basename(current));current=parent; }
    }
  };
  const within = (directory: string, location: string): boolean => {
    const relative = path.relative(physical(directory), physical(location));
    return !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep);
  };
  const lexicallyWithin = (directory: string, location: string): boolean => {
    const relative = path.relative(path.resolve(directory), path.resolve(location));
    return !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep);
  };
  const dependencies = (value: unknown): Dependency[] => {
    assert.ok(Array.isArray(value));
    return value.map((item: unknown): Dependency => {
      assert.ok(item !== null && typeof item === "object");
      assert.ok("path" in item && typeof item.path === "string");
      assert.ok("kind" in item && typeof item.kind === "string");
      assert.ok("scope" in item && typeof item.scope === "string");
      assert.ok("identityStable" in item && typeof item.identityStable === "boolean");
      assert.ok("digest" in item && typeof item.digest === "string");
      return {path:item.path,kind:item.kind,scope:item.scope,identityStable:item.identityStable,digest:item.digest};
    });
  };
  // Dependency identity is lexical path plus kind; aliases retain separate witnesses.
  // Physical equivalence separately retains the original negative/containment oracle.
  const kind = (items: Dependency[], name: string, expectedKind: string, scope = "watch"): void => {
    const matches = items.filter((item) => path.resolve(item.path) === path.resolve(target(name)) && item.kind === expectedKind);
    assert.equal(matches.length, 1, name);
    const item = matches[0]; assert.ok(item !== undefined);
    assert.equal(item.kind, expectedKind, name); assert.equal(item.scope, scope, name);
  };
  const absent = (items: Dependency[], name: string, expectedKind?: string): void => {
    assert.equal(items.some((item) => (path.resolve(item.path) === path.resolve(target(name)) || physical(item.path) === physical(target(name))) && (expectedKind === undefined || item.kind === expectedKind)), false, name);
  };
  const contained = (items: Dependency[]): void => {
    for (const item of items) if (item.kind === "directory" && item.scope === "watch") assert.equal(within(root, item.path), true, item.path);
  };
  const local = (items: Dependency[], entry: string, helpers: string[], excluded: string, allowed: string[]): void => {
    for (const name of [entry,...helpers]) kind(items,name,"file");
    for (const item of items) if (item.scope === "watch" && item.kind !== "directory" && (lexicallyWithin(target(excluded),item.path) || within(target(excluded),item.path))) assert.ok(allowed.some((name) => physical(target(name)) === physical(item.path)), item.path);
  };
  const verify = (name: string, body: () => void): void => { try { body(); } catch(cause) { errors.push(new Error(name,{cause})); } };
  const read = (traces: TraceMeasurements, name: string, rules: Readonly<Record<string,string>>, check: (items: Dependency[]) => void = () => {}): void => {
    verify(name, () => {
      const rows=traces.writerObservations.map((row)=>row.observation).filter((row)=>row.event==="config-loader-result" && row.data?.location===target(name));
      assert.equal(rows.length,1,name);const row=rows[0];assert.ok(row!==undefined);assert.equal(row.data?.dependenciesTracked,true,name);
      const normalized=dependencies(row.data.dependencies);
      observe(traces,target(name),rules,(value) => {
        const raw=dependencies(value);
        const project=(items:Dependency[])=>items.map((item)=>JSON.stringify([path.resolve(item.path),item.kind,item.scope,item.identityStable,item.digest])).sort();
        assert.deepEqual(project(normalized),project(raw),name+": accepted native dependency graph");
        check(normalized);
      });
    });
  };
  const addLink = (name: string, destination: string, absolute = false): boolean => {
    const location = target(name); fs.mkdirSync(path.dirname(location),{recursive:true});
    try { fs.symlinkSync(absolute ? target(destination) : destination,location,"dir"); return true; }
    catch(error) { if(fs.existsSync(location)) throw error; return false; }
  };
  for(const name of ["configs","shared","apps","legacy-project","exports-project","extends","shadow-project","query-project","branch-project","dangling-targets","ignored-exports-main",... ["demo","diamond","hoisted","legacy-main","legacy-main-shared","exports-priority","dangling-main","shadowed","query-exports","exports-branches"].map((name)=>"node_modules/"+name)]) {
    try { fs.lstatSync(target(name)); assert.fail("script graph input already exists: "+target(name)); }
    catch(error) { assert.ok(error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT",String(error)); }
  }
  const exportsLinked = addLink("node_modules/exports-priority/bridge/active","../require");
  const queryLinked = addLink("node_modules/query-exports/bridge/selected","../active");
  fs.mkdirSync(target("dangling-targets/selection"),{recursive:true});
  const danglingLinked = addLink("node_modules/dangling-main/link","dangling-targets/selection",true);
  fs.rmdirSync(target("dangling-targets/selection"));
  let legacyName = "selection";
  try { fs.writeFileSync(target("literal*.probe"),"probe",{flag:"wx"}); fs.unlinkSync(target("literal*.probe")); legacyName="literal*"; }
  catch(error) { if(fs.existsSync(target("literal*.probe"))) throw error; }
  const initial = ["configs/lint.config.cjs","configs/lint.config.mjs","node_modules/demo/lint.config.cjs","configs/manifest.config.cjs","configs/topology.config.cjs","configs/diamond.config.cjs","apps/a/lint.config.cjs","legacy-project/lint.config.cjs","exports-project/lint.config.cjs",...(danglingLinked?["configs/dangling.config.cjs"]:[]),"extends/lint.config.json","shadow-project/lint.config.cjs",...(queryLinked?["query-project/lint.config.cjs"]:[]),"branch-project/lint.config.cjs"];
  const templates = new Map<string,string>();
  const heldEntries = new Map<string,Buffer>();
  const copy = (directory: string, prefix = ""): void => {
    for(const item of fs.readdirSync(directory,{withFileTypes:true})) {
      const name = prefix + (prefix === "" && item.name === "packages" ? "node_modules" : item.name);
      if(item.isDirectory()) { copy(path.join(directory,item.name),name+"/"); continue; }
      if(name === "package.json") continue;
      const location=target(name); assert.equal(fs.existsSync(location),false,location);
      templates.set(name,fs.readFileSync(path.join(directory,item.name),"utf8"));
    }
  };
  copy(template);
  const rendered = (name: string, next: string): string => {
    const source=templates.get(name); assert.ok(source !== undefined,name);
    return source.replaceAll("__NEXT__",JSON.stringify(next)).replaceAll("../shared/","../script-graph-shared/").replaceAll("../../shared/","../../script-graph-shared/").replaceAll("__LEGACY_MAIN__",JSON.stringify(target("node_modules/legacy-main-shared/"+legacyName))).replaceAll("__EXPORTS_TARGET__",JSON.stringify(exportsLinked?"./bridge/active/index.cjs":"./require/index.cjs"));
  };
  const chain = (entries: string[], terminal: string): void => {
    for(let index=0;index<entries.length;index++) {
      const name=entries[index]; assert.ok(name !== undefined);
      const next=entries[index+1]===undefined?terminal:target(entries[index+1]!);
      if(name==="extends/lint.config.json") write("extends/base.config.cjs",rendered("extends/base.config.cjs",next));
      else write(name,rendered(name,next));
    }
  };
  for(const [name] of templates) { const text=rendered(name,path.join(root,"format-only.cjs")); write(name,text); }
  if(legacyName!=="selection") fs.renameSync(target("node_modules/legacy-main-shared/selection.js"),target("node_modules/legacy-main-shared/"+legacyName+".js"));
  fs.mkdirSync(target("shadow-project/node_modules/shadowed"),{recursive:true});
  fs.mkdirSync(target("ignored-exports-main"),{recursive:true});
  chain(initial,path.join(root,"format-only.cjs"));
  for(const name of ["configs/lint.config.cjs","configs/manifest.config.cjs"]) heldEntries.set(name,fs.readFileSync(target(name)));
  const state = {root,traceRoot,target,initial,templates,heldEntries,write,chain,rendered,physical,kind,absent,contained,local,read,verify,errors,exportsLinked,queryLinked,danglingLinked,legacyName,get initialAccepted(){return initialAccepted;},set initialAccepted(value:boolean){initialAccepted=value;},get changedAccepted(){return changedAccepted;},set changedAccepted(value:boolean){changedAccepted=value;}};
  return state;
}

function baseline(state: State, traces: TraceMeasurements): void {
  const {read,kind,local,contained,absent} = state;
  read(traces,"configs/lint.config.cjs",{"no-var":"error"},(items) => {
    local(items,"configs/lint.config.cjs",["shared/selection.cjs"],"node_modules/demo",["node_modules/demo/package.json"]);
    kind(items,"node_modules/demo/index.cjs","file","cache"); contained(items);
  });
  read(traces,"configs/lint.config.mjs",{"no-debugger":"error"},(items) => local(items,"configs/lint.config.mjs",["shared/selection.mjs","shared/leaf.mjs"],"node_modules/demo",[]));
  read(traces,"node_modules/demo/lint.config.cjs",{"no-var":"error"},(items) => local(items,"node_modules/demo/lint.config.cjs",["node_modules/demo/selection.cjs"],"node_modules/demo",["node_modules/demo/lint.config.cjs","node_modules/demo/selection.cjs","node_modules/demo/package.json"]));
  read(traces,"configs/topology.config.cjs",{"no-var":"warning"});
  read(traces,"configs/diamond.config.cjs",{"no-var":"warning"},(items) => {kind(items,"shared/diamond-bridge.cjs","file");kind(items,"shared/diamond-leaf.cjs","file");});
  read(traces,"apps/a/lint.config.cjs",{"no-var":"warning"},(items) => kind(items,"apps/a/package.json","optional-file"));
  read(traces,"legacy-project/lint.config.cjs",{"no-var":"warning"},(items) => {contained(items);kind(items,"node_modules/legacy-main-shared","directory");});
  read(traces,"exports-project/lint.config.cjs",{"no-var":"error"},(items) => {
    kind(items,"node_modules/exports-priority/require","directory");
    absent(items,"node_modules/exports-priority/import"); absent(items,"ignored-exports-main"); absent(items,"node_modules/exports-priority","directory");
    if(state.exportsLinked) {
      kind(items,"node_modules/exports-priority/bridge","directory");
      kind(items,"node_modules/exports-priority/bridge/active","directory");
      assert.equal(state.physical(state.target("node_modules/exports-priority/bridge/active")), state.physical(state.target("node_modules/exports-priority/require")));
    }
  });
  if(state.danglingLinked) read(traces,"configs/dangling.config.cjs",{"no-var":"warning"},(items) => kind(items,"dangling-targets","directory"));
  read(traces,"shadow-project/lint.config.cjs",{"no-var":"error"},(items) => {kind(items,"shadow-project/node_modules/shadowed/index.js","optional-file");absent(items,"shadow-project/node_modules/shadowed","directory");});
  if(state.queryLinked) read(traces,"query-project/lint.config.cjs",{"no-var":"error"},(items) => kind(items,"node_modules/query-exports/bridge","directory"));
  read(traces,"branch-project/lint.config.cjs",{"no-var":"error","no-debugger":"warning","no-eval":"error"},(items) => {kind(items,"node_modules/exports-branches/entry","directory");kind(items,"node_modules/exports-branches/real","directory");absent(items,"node_modules/exports-branches/absent.cjs");});
}

function mutate(state: State): void {
  state.write("node_modules/demo/index.cjs",'module.exports="warning";');
  state.write("apps/node_modules/hoisted/package.json",'{"main":"lib/index"}');
  state.write("apps/node_modules/hoisted/lib/index.js",'module.exports="warning";');
  state.write("node_modules/legacy-main-shared/"+state.legacyName,'module.exports="error";');
  if(state.exportsLinked) { fs.unlinkSync(state.target("node_modules/exports-priority/bridge/active"));fs.symlinkSync("../import",state.target("node_modules/exports-priority/bridge/active"),"dir"); }
  if(state.danglingLinked) state.write("dangling-targets/selection/index.cjs",'module.exports="error";');
  state.write("shadow-project/node_modules/shadowed/index.js",'module.exports="warning";');
  if(state.queryLinked) { fs.unlinkSync(state.target("node_modules/query-exports/bridge/selected"));fs.symlinkSync("../fallback",state.target("node_modules/query-exports/bridge/selected"),"dir"); }
}

function changed(state: State, traces: TraceMeasurements): void {
  const {read,kind,local,absent} = state;
  for(const [name,bytes] of state.heldEntries) state.verify(name+": unchanged entry",()=>assert.deepEqual(fs.readFileSync(state.target(name)),bytes));
  read(traces,"configs/lint.config.cjs",{"no-var":"warning"},(items) => local(items,"configs/lint.config.cjs",["shared/selection.cjs"],"node_modules/demo",["node_modules/demo/package.json"]));
  read(traces,"configs/manifest.config.cjs",{"no-var":"warning"});
  read(traces,"apps/a/lint.config.cjs",{"no-var":"warning"},(items) => {absent(items,"apps/node_modules/hoisted","directory");kind(items,"apps/node_modules/hoisted/lib","directory");});
  read(traces,"legacy-project/lint.config.cjs",{"no-var":"error"});
  if(state.exportsLinked) read(traces,"exports-project/lint.config.cjs",{"no-var":"warning"});
  if(state.danglingLinked) read(traces,"configs/dangling.config.cjs",{"no-var":"error"});
  read(traces,"shadow-project/lint.config.cjs",{"no-var":"warning"});
  if(state.queryLinked) read(traces,"query-project/lint.config.cjs",{"no-var":"warning"});
}

/**
 * Completes the shared loader graph using the already owned normal resident.
 *
 * @evidence contracts/testing.md#behavioral-verification One actual nonzero project-inputs reply follows the loader's not-ready exception; repairing only its helper produces code0 and the original warning value. CJS helper/main third epochs and typed require/import values retain their own raw dependency envelopes. JSON extends must publish its nested reload directory.
 * @evidence contracts/testing.md#independent-expectations Literal error/warning values and named exact dependency kinds/scopes/absences prescribe results. The prior CLI observations are prerequisites, not expected values generated by discovery.
 * @evidence contracts/testing.md#distinguishing-cases Failed versus repaired module, first package versus helper refresh, extension fallback versus exact main and CommonJS .ts versus ESM .mts remain separate boundaries.
 * @evidence contracts/testing.md#execution-ownership The original resident normal child answers two extra serial requests before its original seven. Each expected reply code is checked by the same bounded protocol reader; the normal and opt-out lifetimes still close before restoration.
 * @evidence contracts/e2e.md#necessary-boundary Actual isolated Node/ttsx evaluations and public project-inputs publication must agree. Neither generated config DTOs nor direct Go test invocation replaces their transport.
 * @evidence contracts/e2e.md#shared-execution Reuses the existing prepared binary and normal child; CLI2, server2, prepare1 and installation1 remain unchanged. Normal requests7 become9. Project-inputs does not directly load a Program, but executable typed evaluators perform real preparation/compiler work whose total is not claimed zero.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity ScriptGraph entries/helpers have distinct identities from original resident real/link counter modules. Both added replies settle before original normal config bytes return, so original normal/optout baselines remain explicit. Child closure owns final input restoration.
 * @evidence contracts/e2e.md#preserved-coverage Preserves original three-stage CJS/package candidate transitions, fail/repair freshness, typed conditional exports and final nested resolver publication. The original Go donor remains until actual acceptance.
 */
export async function scriptConfigGraphResident(workspace: BatchWorkspace.Workspace, lintConfig: string, ask: (expectedCode?:number) => Promise<unknown>): Promise<void> {
  const state=states.get(workspace); assert.ok(state!==undefined,"shared CLI graph must be authored first");
  const original=fs.readFileSync(lintConfig);
  let settled=true;
  try {
    assert.equal(state.initialAccepted,true,"first CLI raw observations must complete");
    assert.equal(state.changedAccepted,true,"warning CLI raw observations must complete");
    const heldCjs=fs.readFileSync(state.target("configs/lint.config.cjs"));
    const heldPackage=fs.readFileSync(state.target("node_modules/demo/package.json"));
    state.write("shared/selection.cjs",'require("demo");module.exports={rule:"error"};');
    state.write("apps/node_modules/hoisted/lib/index",'module.exports="error";');
    const failed=[...state.initial,"configs/failing.config.cjs","configs/exports-require.config.ts","configs/exports.config.mts"];
    state.chain(failed,path.join(state.root,"format-only.cjs"));
    fs.writeFileSync(lintConfig,"module.exports="+JSON.stringify({extends:state.target(failed[0]!)}));
    let cursor=readE2eTraceMeasurements(state.traceRoot,[]).lastWriterSequences;
    settled=false;
    await ask(2);
    settled=true;
    assert.deepEqual(fs.readFileSync(state.target("configs/lint.config.cjs")),heldCjs);
    assert.deepEqual(fs.readFileSync(state.target("node_modules/demo/package.json")),heldPackage);
    let traces=readE2eTraceMeasurements(state.traceRoot,[],cursor);
    state.read(traces,"configs/lint.config.cjs",{"no-var":"error"},(items) => {state.local(items,"configs/lint.config.cjs",["shared/selection.cjs"],"node_modules/demo",["node_modules/demo/package.json"]);state.contained(items);});
    state.read(traces,"apps/a/lint.config.cjs",{"no-var":"error"});
    state.verify("failed module owns a real loader error",() => {
      const rows=traces.writerObservations.map((row)=>row.observation).filter((row)=>row.event==="config-loader-result" && row.data?.location===state.target("configs/failing.config.cjs"));
      assert.equal(rows.length,1); const row=rows[0];assert.ok(row!==undefined);assert.equal(row.data?.success,false);assert.ok(typeof row.data?.error === "string" && row.data.error.includes("not ready"));
      const terminals=traces.writerObservations.map((entry)=>entry.observation).filter((entry)=>entry.writerPid===row.writerPid && entry.instance===row.instance && entry.invocation===row.invocation && entry.event==="process-result");
      assert.equal(terminals.length,1); assert.equal(terminals[0]?.data?.exitObserved,true);assert.equal(terminals[0]?.data?.exitCode,1);
    });
    state.write("shared/topology.js",'module.exports="error";');
    state.write("node_modules/demo/package.json",'{"main":"alternate.cjs"}');
    const heldFailing=fs.readFileSync(state.target("configs/failing.config.cjs"));
    state.write("shared/failing.cjs",'module.exports={fail:false,rule:"warning"};');
    state.write("node_modules/exports-priority/package.json",'{"exports":{".":{"import":"./import/index.cjs","require":"./require/index.cjs"}}}');
    const recovered=[...state.initial.slice(3),"configs/failing.config.cjs","configs/exports-require.config.ts","configs/exports.config.mts"];
    state.chain(recovered,path.join(state.root,"format-only.cjs"));
    fs.writeFileSync(lintConfig,"module.exports="+JSON.stringify({extends:state.target(recovered[0]!)}));
    cursor=readE2eTraceMeasurements(state.traceRoot,[]).lastWriterSequences;
    settled=false;
    const reply=await ask(0);
    settled=true;
    assert.deepEqual(fs.readFileSync(state.target("configs/failing.config.cjs")),heldFailing);
    traces=readE2eTraceMeasurements(state.traceRoot,[],cursor);
    state.read(traces,"configs/manifest.config.cjs",{"no-var":"error"},(items) => state.kind(items,"node_modules/demo/package.json","file"));
    state.read(traces,"configs/topology.config.cjs",{"no-var":"error"},(items)=>state.kind(items,"shared","directory"));
    state.read(traces,"configs/failing.config.cjs",{"no-var":"warning"});
    state.read(traces,"configs/exports-require.config.ts",{"no-var":"error"},(items)=>state.kind(items,"node_modules/exports-priority/require","directory"));
    state.read(traces,"configs/exports.config.mts",{"no-var":"warning"},(items)=>state.kind(items,"node_modules/exports-priority/import","directory"));
    state.verify("JSON extends publishes nested executable directory",()=>{
      assert.ok(reply!==null && typeof reply==="object" && "reloadDirectories" in reply && Array.isArray(reply.reloadDirectories));
      assert.equal(reply.reloadDirectories.some((item:unknown)=>typeof item==="string" && state.physical(item)===state.physical(state.target("extends"))),true);
    });
  } catch(error) { state.errors.push(error); } finally { if(settled) fs.writeFileSync(lintConfig,original); else BatchWorkspace.retain("script config resident reply ownership unresolved"); }
  if(state.errors.length) {
    if(process.env.TTSC_E2E_TRACE===undefined) {
      try { TestProject.retainTemporaryDirectory(state.traceRoot,"ScriptGraph raw loader and reply assertions failed"); }
      catch(error) { state.errors.push(error); }
    }
    throw new AggregateError(state.errors,"shared script config graph");
  }
  states.delete(workspace);
}

/**
 * Observes one already completed shared CLI epoch without a new evaluation.
 *
 * @evidence contracts/testing.md#behavioral-verification Checks the actual returned loader values and exact dependency oracles from this closed CLI window.
 * @evidence contracts/testing.md#independent-expectations Authored paths, literal rules and dependency kinds/scopes/absence specify expectations.
 * @evidence contracts/testing.md#distinguishing-cases First and changed epochs retain independent module and metadata boundaries.
 * @evidence contracts/testing.md#execution-ownership Existing nativeLintConfigCorpus owns both CLI calls; this adapter reads their captured outcomes only.
 * @evidence contracts/e2e.md#necessary-boundary Actual executable configuration and native dependency transport remain the observed boundary.
 * @evidence contracts/e2e.md#shared-execution Uses the existing shared root, trace reader and completed CLI result, adding no actor or prepare.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The phase is recorded only after its actual CLI completes; later mutations remain ordered.
 * @evidence contracts/e2e.md#preserved-coverage Retains the donor module values and raw dependency distinctions before the resident completes remaining transitions.
 */
export function observeScriptConfigGraph(workspace:BatchWorkspace.Workspace,traces:TraceMeasurements,phase:"first"|"second"): void {
  const state=states.get(workspace);assert.ok(state!==undefined);
  if(phase==="first"){baseline(state,traces);state.initialAccepted=true;}else{changed(state,traces);state.changedAccepted=true;}
}

/**
 * Authors the next shared graph epoch after the first CLI has closed.
 *
 * @evidence contracts/testing.md#behavioral-verification Changes only owned package/candidate/link inputs; the following existing CLI must return their independently prescribed values.
 * @evidence contracts/testing.md#independent-expectations Authored paths, literal rules and dependency kinds/scopes/absence specify expectations.
 * @evidence contracts/testing.md#distinguishing-cases First and changed epochs retain independent module and metadata boundaries.
 * @evidence contracts/testing.md#execution-ownership Existing nativeLintConfigCorpus owns both CLI calls; this adapter reads their captured outcomes only.
 * @evidence contracts/e2e.md#necessary-boundary Actual executable configuration and native dependency transport remain the observed boundary.
 * @evidence contracts/e2e.md#shared-execution Uses the existing shared root, trace reader and completed CLI result, adding no actor or prepare.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The phase is recorded only after its actual CLI completes; later mutations remain ordered.
 * @evidence contracts/e2e.md#preserved-coverage Retains the donor module values and raw dependency distinctions before the resident completes remaining transitions.
 */
export function advanceScriptConfigGraph(workspace:BatchWorkspace.Workspace): void {
  const state=states.get(workspace);assert.ok(state!==undefined);mutate(state);
}

/**
 * Returns the existing owned observation sink for the reused resident child.
 *
 * @evidence contracts/testing.md#behavioral-verification Preserves the same actual trace sink across the two existing CLI windows and their dependent resident requests.
 * @evidence contracts/testing.md#independent-expectations Authored paths, literal rules and dependency kinds/scopes/absence specify expectations.
 * @evidence contracts/testing.md#distinguishing-cases First and changed epochs retain independent module and metadata boundaries.
 * @evidence contracts/testing.md#execution-ownership Existing nativeLintConfigCorpus owns both CLI calls; this adapter reads their captured outcomes only.
 * @evidence contracts/e2e.md#necessary-boundary Actual executable configuration and native dependency transport remain the observed boundary.
 * @evidence contracts/e2e.md#shared-execution Uses the existing shared root, trace reader and completed CLI result, adding no actor or prepare.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The phase is recorded only after its actual CLI completes; later mutations remain ordered.
 * @evidence contracts/e2e.md#preserved-coverage Retains the donor module values and raw dependency distinctions before the resident completes remaining transitions.
 */
export function scriptConfigGraphTraceRoot(workspace: BatchWorkspace.Workspace): string {
  const state=states.get(workspace);assert.ok(state!==undefined);return state.traceRoot;
}
