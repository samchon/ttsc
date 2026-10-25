import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import processWitness from "./process-witness.cjs";
import { createTtscTransformCache, resetTtscTransformCache, resolveOptions, shareTtscTransformCache, transformTtsc } from "@ttsc/unplugin/api";

const root = process.cwd();
const source = path.join(root, "index.ts");
const schema = path.join(root, "node_modules/sql-mapper/schema.txt");
const manifest = path.join(root, "node_modules/sql-mapper/package.json");
const log = path.join(root, "node_modules/sql-mapper/mapper.log");
const originalArguments = process.env.TTSC_TSGO_ARGS;
const originalArgumentCwd = process.env.TTSC_TSGO_ARGS_CWD;
const options = { project: "tsconfig.json", runExternalCode: true };
const graphPlugins = JSON.parse(fs.readFileSync("graph-plugins.json", "utf8"));
// Bun owns its actual adapter build. Node owns the cache epochs because its
// supported module hooks can establish complete plugin descriptor observations.
const bundle = spawnSync(process.env.TTSC_BUN_BINARY ?? "bun", ["bundle.mjs"], { cwd: root, env: process.env, encoding: "utf8", windowsHide: true });
assert.equal(bundle.error, undefined);
assert.equal(bundle.signal, null);
assert.equal(bundle.status, 0, bundle.stderr || bundle.stdout);
assert.match(bundle.stdout, /content-mappers:bundle-passed/);
const caches = [createTtscTransformCache(), createTtscTransformCache()];
const store = path.join(root, "shared-store");
fs.mkdirSync(store);
for (const cache of caches) shareTtscTransformCache(cache, store);
const deliver = (permission, cache = caches[0], recoveryInput, plugins) => transformTtsc(source, fs.readFileSync(source, "utf8"), resolveOptions({ ...options, ...(plugins === undefined ? {} : { plugins }), runExternalCode: permission }), undefined, cache, { exactPath: true, watching: false, markVolatile() {}, addWatchFile(file) { recoveryInput?.(file); } });
const events = () => fs.readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line));
try {
  const [allowed, denied] = await Promise.allSettled([deliver(true), deliver(false, caches[1])]);
  assert.equal(allowed.status, "fulfilled");
  assert.equal(denied.status, "rejected");
  assert.match(String(denied.reason), /18068|Content mappers require/);
  const prior = events().length;
  await deliver(true);
  assert.equal(events().length, prior, "unchanged invocation reuses the resident generation");
  resetTtscTransformCache(caches[1]);
  await deliver(true, caches[1]);
  assert.equal(events().length, prior, "an equivalent worker adopts the shared compilation");
  await deliver(undefined, caches[1]);

  fs.writeFileSync(schema, "number");
  await assert.rejects(deliver(true), /2322|not assignable/);
  fs.writeFileSync(source, 'import type { query } from "./query.sql"; export const value: typeof query = { name: 1 };\n');
  await deliver(true);
  // A complete syntactic banner may exclude unconsulted type-only edges.
  // Establish the unmarked program contributor's generation before editing SQL.
  const deliverGraph = () => deliver(true, caches[0], undefined, graphPlugins);
  await deliverGraph();
  const graphBaseline = events().length;
  await deliverGraph();
  assert.equal(events().length, graphBaseline, "unchanged graph-dependent invocation reuses its resident generation");
  fs.writeFileSync("query.sql", "label");
  await assert.rejects(deliverGraph(), /2353|does not exist/);
  fs.writeFileSync(source, 'import type { query } from "./query.sql"; export const value: typeof query = { label: 1 };\n');
  await deliverGraph();
  await deliver(true);
  fs.unlinkSync(schema);
  await assert.rejects(deliver(true), /2322|not assignable/);
  fs.writeFileSync(source, 'import type { query } from "./query.sql"; export const value: typeof query = { label: "ok" };\n');
  await deliver(true);
  const beforeManifest = events().length;
  const changed = JSON.parse(fs.readFileSync(manifest, "utf8"));
  changed.version = "1.0.1";
  fs.writeFileSync(manifest, JSON.stringify(changed));
  await deliver(true);
  assert.ok(events().length > beforeManifest, "a mapper package update invalidates output");
  fs.writeFileSync(source, 'import type { query } from "./query.sql"; export const value: typeof query = { label: undefined };\n');
  fs.writeFileSync("flags.rsp", "--strict false");
  await deliver(true);
  fs.writeFileSync("flags.rsp", "--strict");
  await assert.rejects(deliver(true), /2322|not assignable/);
  fs.writeFileSync("flags.rsp", "--strict false");
  await deliver(true);
  fs.writeFileSync(source, 'import type { query } from "./query.sql"; export const value: typeof query = { label: "ok" };\n');
  fs.writeFileSync("other.sql", "@");
  await assert.rejects(deliver(true), /1131|Property or signature expected/);
  fs.unlinkSync("other.sql");
  await deliver(true);
  const unicodeBaseline = events().length;
  await deliver(true);
  assert.equal(events().length, unicodeBaseline, "unchanged invocation reuses before the Unicode root is added");
  fs.writeFileSync("other.İ", "@");
  await assert.rejects(deliver(true), /1131|Property or signature expected/);
  fs.unlinkSync("other.İ");
  await deliver(true);
  fs.writeFileSync("extra.js", "export const value = ;");
  await deliver(true);
  fs.writeFileSync("flags.rsp", "--strict false --allowJs");
  await assert.rejects(deliver(true), /1109|Expression expected/);
  fs.unlinkSync("extra.js");
  await deliver(true);
  const savedManifest = fs.readFileSync(manifest, "utf8");
  const recovery = [];
  fs.unlinkSync(manifest);
  try {
    await assert.rejects(deliver(true, caches[0], (file) => recovery.push(file)), /content mapper package.*could not be resolved/i);
  } finally {
    fs.writeFileSync(manifest, savedManifest);
  }
  assert.ok(recovery.some((file) => { try { return fs.realpathSync(file) === fs.realpathSync(manifest); } catch { return false; } }), "a failed config retains the mapper manifest repair path");
  await deliver(true);
  const webpackConfig = JSON.parse(fs.readFileSync("tsconfig.json", "utf8"));
  webpackConfig.compilerOptions.plugins = [];
  fs.writeFileSync("tsconfig.json", JSON.stringify(webpackConfig));
  const webpackEpoch = (permission, expected, args) => {
    const child = spawnSync(process.execPath, ["webpack-permission.mjs", permission, expected], {cwd:root, env:{...process.env, TTSC_TSGO_ARGS:JSON.stringify(args)}, encoding:"utf8", windowsHide:true});
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr || child.stdout);
  };
  const inherited = JSON.parse(originalArguments);
  const deniedArguments = [...inherited,"--runExternalCode","false"];
  webpackEpoch("inherit", "built", inherited);
  webpackEpoch("inherit", "restored", inherited);
  webpackEpoch("inherit", "denied", deniedArguments);
  webpackEpoch("inherit", "built", inherited);
  webpackEpoch("false", "denied", inherited);
  webpackEpoch("true", "built", deniedArguments);
  assert.equal(process.env.TTSC_TSGO_ARGS, originalArguments);
  assert.equal(process.env.TTSC_TSGO_ARGS_CWD, originalArgumentCwd);
} finally {
  for (const cache of caches) resetTtscTransformCache(cache);
}
const recorded = events();
assert.equal(recorded.filter((event) => event.method === "openProject").length, recorded.filter((event) => event.method === "closeProject").length);
for (const witness of new Map(recorded.map((event) => [event.pid + ":" + (event.endpoint ?? event.identity), event])).values())
  assert.equal(await processWitness.departed(witness), true, "the original mapper process must have been reaped");
console.log("content-mappers:passed");
