import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
 * @evidence contracts/testing.md#distinguishing-cases Two processes request different modules through different built adapters with identical project options and session identity. Removed effects and retained publication distinguish transformation from passthrough.
 * @evidence contracts/testing.md#execution-ownership One pool starts two workers, each submitting one delivery. All workers settle before verdict collection; native producer count is asserted separately.
 * @evidence contracts/e2e.md#necessary-boundary Built loaders, inherited session and real producer cross process boundaries. This is not a running Next or Metro server.
 * @evidence contracts/e2e.md#shared-execution The pool borrows the one immutable prepared population and explicit project. No worker creates a project or a per-case producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Environment copies and a fresh session isolate the pool. Actual close is joined; missed deadlines reject as unresolved ownership and retain inputs.
 * @evidence contracts/e2e.md#preserved-coverage Metro forwarding and Turbopack source/map/dependency delivery retain the two-worker single-compile distinction. Successful delivery does not certify failed compile retention or watcher transitions.
 */
export async function test_e2e_metro_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const lib = path.join(TestProject.WORKSPACE_ROOT, "packages/metro/lib");
  const baseline = fs.existsSync(workspace.programRunLog) ? fs.statSync(workspace.programRunLog).size : 0;
  const run = (mode: "metro" | "turbopack"): Promise<any> => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(workspace.root, "loader-pool.mjs"), mode, workspace.root,
      pathToFileURL(path.join(lib, "transformer.mjs")).href,
      pathToFileURL(path.join(lib, "core/options.mjs")).href,
      TestUnpluginRuntime.libUrl("turbopack")], {
      cwd: workspace.root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", TTSC_CACHE_DIR: workspace.cache, TTSC_UNPLUGIN_TRANSFORM_SESSION: path.join(workspace.root, "loader-pool-session") },
    });
    let stdout = "", stderr = "";
    let failure: Error | undefined;
    const deadline = setTimeout(() => reject(new Error(`${mode} worker close remains unresolved: ${stderr}`)), 120_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => { failure = error; });
    child.once("close", (code, signal) => {
      clearTimeout(deadline);
      if (failure) reject(failure);
      else if (code !== 0 || signal !== null) reject(new Error(`${mode}: status=${code} signal=${signal}\n${stderr}`));
      else { try { resolve(JSON.parse(stdout)); } catch (cause) { reject(cause); } }
    });
  });
  const outcomes = await Promise.allSettled([run("metro"), run("turbopack")]);
  const failures = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
  if (failures.length) throw new AggregateError(failures.map((outcome) => outcome.reason), "loader pool outcomes");
  const [metro, turbopack] = outcomes.map((outcome) => (outcome as PromiseFulfilledResult<any>).value);
  assert.equal(metro.ast.filename, "src/bundle.ts");
  assert.deepEqual(metro.ast.options, { projectRoot: workspace.root, platform: "ios" });
  assert.deepEqual(metro.ast.plugins, ["authored-babel-plugin"]);
  assert.equal(typeof metro.ast.source, "string");
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
}