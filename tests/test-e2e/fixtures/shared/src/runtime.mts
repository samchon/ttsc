import "./runtime-corpus/import-binding/main.mjs";
import { observeConfiguredOwners } from "./runtime-corpus/configured-owners.mjs";
import { observeExportPopulation } from "./runtime-corpus/export-population/observe.mjs";
import adapterEntries from "../adapter-entries.json" with { type: "json" };
import { sourceLocations } from "./source-locations.js";
import { createMemFS, parseResult } from "@ttsc/wasm";
import { packageNameFromSpecifier } from "@ttsc/playground";
import { result, observeEmittedEffects } from "./bundle.js";
import { cliPolicyRuntime } from "./runtime-corpus/cli-policy.mjs";
import { helperMain, observeNodeCompatibleCorpus } from "./runtime-corpus/node-compatible.mjs";
import { observeRequireBindings } from "./runtime-corpus/require-shadow.mjs";
import { observed as nativeFactory } from "./runtime-corpus/native-factory.js";
import "./runtime-corpus/declared-entry.js";
await (await import("../tools/runtime-owned-descendant.cjs")).default();
const host = createMemFS();
observeEmittedEffects();
host.writeFile("/main.ts", "export const value = 1;\n");
const standardEsm = await import("./runtime-corpus/standard/index.mjs");
const standardCommonjs = await import("./runtime-corpus/standard/index.cjs");
const memberEsm = await import("./runtime-corpus/member.mjs");
const memberCommonjs = await import("./runtime-corpus/member.cjs");
const contraryCommonjs = await import("./runtime-corpus/cts-contrary/main.cjs");
const mtsImport = await import("./runtime-corpus/mts-import/main.mjs");
const dual = await import("./runtime-corpus/dual/main.mjs");
const ownership = await import("./runtime-corpus/ownership/main.cjs");
const normalPopulation = await import("./runtime-corpus/normal-population/index.cjs");
const stackInside = await import("./runtime-corpus/stack/inside.cjs");
const stackOutside = await import("./runtime-corpus/stack/outside.cjs");
const proposal = await import("./runtime-corpus/proposal.mjs");
const adapterFactories = await Promise.all(adapterEntries.map(async (entry: string) => typeof (await import(entry)).default));
const mixedRuntime = {
  nativeFactory,
  contraryCommonjs: contraryCommonjs.observed,
  mtsImport: mtsImport.observed,
  dual: dual.observed,
  sameNamedOwnership: ownership.observed,
  rawPackageOwnership: ownership.packageOwn,
  rawLowering: ownership.rawLowering,
  standardEsm: standardEsm.observed,
  standardCommonjs: standardCommonjs.observed,
  memberEsm: memberEsm.observed,
  memberCommonjs: memberCommonjs.observed,
  adapterFactories,
  answers: [standardEsm.answer, standardCommonjs.answer],
  requestedSource: [standardEsm.own, standardCommonjs.own],
  proposalValue: proposal.proposalValue,
  startupMarkers: proposal.startupMarkers,
  mainMessage: proposal.mainMessage(),
  optionalChainPreserved: proposal.optionalChainPreserved,
};
const exportPopulation = await observeExportPopulation();
const configuredOwners = await observeConfiguredOwners();
const nodeCompatible = await observeNodeCompatibleCorpus();
const nativeFrames = [stackInside.frame, stackOutside.frame];
const requireBindings = await observeRequireBindings();
console.info("relative-runner-cache");
console.info("TTSC_BATCH:" + JSON.stringify({ ...result, exportPopulation, configuredOwners, normalPopulation: normalPopulation.observed, nativeFrames, sourceLocations, mixedRuntime, cliPolicyRuntime, nodeCompatible, requireBindings, entryPolicy: { main: "main" in import.meta ? (import.meta as ImportMeta & { main?: boolean }).main : null, helperMain, url: import.meta.url }, publicHelpers: {
  memoryFile: host.readFileText("/main.ts"),
  decoded: parseResult({ result: '{"value":1}' } as never),
  scoped: packageNameFromSpecifier("@scope/package/subpath"),
  builtin: packageNameFromSpecifier("node:fs"),
} }));






