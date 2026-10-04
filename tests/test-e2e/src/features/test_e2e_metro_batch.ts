import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createLoaderPoolWorker, type LoaderPoolOutcome } from "../batch/LoaderPoolWorker";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { originalPositionFor } from "../internal/unplugin/internal/source-map/originalPositionFor";
import { positionOf } from "../internal/unplugin/internal/source-map/positionOf";

/**
 * Delivers distinct modules through one shared native loader pool.
 *
 * @evidence contracts/testing.md#behavioral-verification Metro forwards transformed source and original arguments; Turbopack completes once with executable source, matching map and dependency records. The actual ApplyProgram log grows by one across both joined workers.
 * @evidence contracts/testing.md#independent-expectations Original coordinates, marker, caller arguments and native ApplyProgram log distinguish delivery and shared compilation independently of adapter counters.
 * @evidence contracts/testing.md#distinguishing-cases Two resident processes request different modules through different built adapters, then observe failure/replay/repair under the same options/session; real publication identities distinguish reuse from another compile.
 * @evidence contracts/testing.md#execution-ownership One pool starts two resident workers, each observing normal/failure/replay/repair and changed-external/replay states. No request creates another worker, host, project or configuration profile; initial native producer receipt and later publication identities are asserted separately.
 * @evidence contracts/e2e.md#necessary-boundary Built loaders, inherited session and real producer cross process boundaries. This is not a running Next or Metro server.
 * @evidence contracts/e2e.md#shared-execution The pool borrows the one immutable prepared population and explicit project. No worker creates a project or a per-case producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Environment copies and a fresh session isolate the pool. Actual close is joined; missed deadlines reject as unresolved ownership and retain inputs.
 * @evidence contracts/e2e.md#preserved-coverage Metro forwarding and Turbopack source/map/dependency delivery retain the two-worker single-compile distinction. Adds actual shared failed publication/replay/repair while preserving initial arguments/map/dependency delivery; arbitrary restart, dead-owner takeover and observer transitions remain unproved.
 */
export async function test_e2e_metro_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const lib = path.join(TestProject.WORKSPACE_ROOT, "packages/metro/lib");
  const baseline = fs.existsSync(workspace.programRunLog) ? fs.statSync(workspace.programRunLog).size : 0;
  const session = path.join(workspace.root, "loader-pool-session");
  const workers = (["metro", "turbopack"] as const).map((mode) => createLoaderPoolWorker({
    mode, root: workspace.root, cache: workspace.cache, session,
    metro: pathToFileURL(path.join(lib, "transformer.mjs")).href,
    options: pathToFileURL(path.join(lib, "core/options.mjs")).href,
    turbopack: TestUnpluginRuntime.libUrl("turbopack"),
  }));
  const contractPath = path.join(workspace.root, "src/contract.ts");
  const originalContract = fs.readFileSync(contractPath);
  const bannerPath = path.join(workspace.root, "banner.config.json");
  const originalBanner = fs.readFileSync(bannerPath);
  let bodyFailure: unknown;
  try {
  const outcomes = await Promise.allSettled(workers.map((worker) => worker.request()));
  const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map((outcome) => outcome.reason), "loader pool outcomes");
  const [metro, turbopack] = outcomes.map((outcome) => {
    const reply = (outcome as PromiseFulfilledResult<LoaderPoolOutcome>).value;
    assert.equal(reply.error, undefined); return reply.value;
  });
  assert.equal(metro.ast.filename, "src/bundle.ts");
  assert.deepEqual(metro.ast.options, { projectRoot: workspace.root, platform: "ios" });
  assert.deepEqual(metro.ast.plugins, ["authored-babel-plugin"]);
  assert.equal(typeof metro.ast.source, "string");
  assert.match(metro.ast.source, /Shared boundary corpus/);
  assert.match(metro.ast.source, /Authored source positions remain observable/);
  assert.notEqual(metro.ast.source, fs.readFileSync(path.join(workspace.root, "src/bundle.ts"), "utf8"));
  assert.equal(/(?:^|[;\n])\s*discard\.call\(\)/.test(metro.ast.source), false);
  assert.equal(metro.ast.source.includes("STRIPPED_DEBUG_RAN"), false);
  assert.ok(metro.ast.source.includes("TTSC_BATCH_RESULT"));
  assert.equal(turbopack.completions, 1);
  assert.deepEqual(turbopack.errors, []);
  assert.equal(turbopack.value, "authored-marker");
  assert.ok(turbopack.dependencies.length > 0);
  for (const dependency of turbopack.dependencies) {
    assert.ok(fs.existsSync(dependency));
    const relative = path.relative(workspace.root, dependency);
    assert.equal(relative.startsWith("..") || path.isAbsolute(relative), false);
    assert.notEqual(dependency, path.join(workspace.root, "src/map.ts"));
  }
  const generated = positionOf(turbopack.content, '"authored-marker"');
  const original = originalPositionFor(turbopack.map, generated.line, generated.column);
  assert.ok(original);
  assert.match(original.source, /map\.ts$/);
  assert.deepEqual({ line: original.line, column: original.column }, positionOf(fs.readFileSync(path.join(workspace.root, "src/map.ts"), "utf8"), '"authored-marker"'));
  assert.equal(fs.statSync(workspace.programRunLog).size - baseline, 1, "one actual native Program serves the two-worker pool");
  const publications = () => fs.readdirSync(session).filter((name) => name.endsWith(".json")).sort().map((name) => {
    const value = JSON.parse(fs.readFileSync(path.join(session, name), "utf8"));
    return { name, type: value.result.type, scratchDirectory: value.scratchDirectory };
  });
  // These state transitions keep the same two actual adapter/cache owners.
  fs.appendFileSync(contractPath, "\nexport type PooledBroken = NotARealExternalType;\n");
  const failed = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of failed) assert.match(reply.error ?? "", /NotARealExternalType/);
  const failedPublications = publications();
  assert.equal(failedPublications.filter((publication) => publication.type === "failure").length, 1);
  const replay = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of replay) assert.match(reply.error ?? "", /NotARealExternalType/);
  assert.deepEqual(publications(), failedPublications, "both residents reuse the failed publication without publishing another compile");
  fs.writeFileSync(contractPath, originalContract);
  const repaired = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of repaired) { assert.equal(reply.error, undefined); assert.ok(reply.value); }
  assert.equal(repaired[0]!.value.ast.source, metro.ast.source, "repair restores the actual Metro native output");
  assert.equal(repaired[1]!.value.content, turbopack.content, "repair restores the actual Turbopack native output");
  assert.ok(publications().some((publication) => publication.type === "success"), "repair observes an actual successful publication");
  fs.writeFileSync(bannerPath, JSON.stringify({ text: "Pooled second banner\nIndependent external-config state" }));
  const external = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of external) { assert.equal(reply.error, undefined); assert.ok(reply.value); }
  assert.match(external[0]!.value.ast.source, /Pooled second banner/);
  assert.doesNotMatch(external[0]!.value.ast.source, /Shared boundary corpus/);
  const changedExternal = publications();
  const externalReplay = await Promise.all(workers.map((worker) => worker.request()));
  for (const reply of externalReplay) assert.equal(reply.error, undefined);
  assert.equal(externalReplay[0]!.value.ast.source, external[0]!.value.ast.source);
  assert.equal(externalReplay[1]!.value.content, external[1]!.value.content);
  assert.deepEqual(publications(), changedExternal, "steady external state is adopted without another publication");
  } catch (error) { bodyFailure = error; } finally {
    fs.writeFileSync(contractPath, originalContract);
    fs.writeFileSync(bannerPath, originalBanner);
    const closes = await Promise.allSettled(workers.map((worker) => worker.close()));
    const failedCloses = closes.filter((entry): entry is PromiseRejectedResult => entry.status === "rejected");
    const failures = failedCloses.map((entry) => entry.reason);
    if (bodyFailure !== undefined) failures.unshift(bodyFailure);
    if (failures.length) throw new AggregateError(failures, "resident loader pool delivery and close");
  }
}