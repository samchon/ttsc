import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { CapabilityResolutionFormat } from "../../../../packages/ttsc/lib/plugin/internal/CapabilityResolutionFormat";
import { loadProjectPlugins } from "../../../../packages/ttsc/lib/plugin/internal/load/loadProjectPlugins";
import { resolveCapabilityPluginResolution } from "../../../../packages/ttsc/lib/plugin/resolveCapabilityPlugins";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies mapped-resolution witnesses through ordinary descriptor loading and
 * capability persistence, with empty NODE_OPTIONS and no authored phase hook.
 * The ordinary evaluator may install its standard runtime preload; this corpus
 * introduces no separate native producer.
 *
 * The static descriptor resolves the far package before creating a nearer one.
 * This after-resolution change contrasts with the direct owning operation's
 * inside-resolution window; it proves ordinary consumer refusal and recovery,
 * rather than claiming an executed stale cache hit. All three projects share
 * the already prepared public Go source and one native cache allocation.
 *
 * 1. Publish and replay the stable FAR descriptor's capability answer.
 * 2. Preserve missing proof when that descriptor creates a nearer package.
 * 3. Refuse the changed answer, then discover and replay a fresh NEAR answer.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual loadProjectPlugins returns FAR with the now-present nearer manifest known but unproved. Ordinary capability resolution refuses publication/currentness for that generation, then discovers NEAR and replays the stable published answer without another factory evaluation. A separate stable FAR project must publish and replay.
 * @evidence contracts/testing.md#independent-expectations Static package files supply literal FAR and NEAR values; the append-only counter independently identifies descriptor evaluations. Explicit absence/presence checks and own-property proof checks distinguish missing proof from a certified absent file.
 * @evidence contracts/testing.md#distinguishing-cases Stable FAR reuse contrasts with changed FAR refusal and fresh NEAR recovery. Direct loader observations and capability persistence are separate assertions; descriptor caches and capability caches must both preserve the original generation's proof authority.
 * @evidence contracts/testing.md#execution-ownership The selected Metro caller executes this synchronous corpus after restoring its tool protocol. Every independent case is collected before aggregate failure. The production synchronous evaluator/build owners join their selected children; this corpus introduces no detached process.
 * @evidence contracts/e2e.md#necessary-boundary Direct recorder/runtime units cannot establish actual descriptor evaluator transfer, native plugin construction, capability cache admission or replay through public production APIs.
 * @evidence contracts/e2e.md#shared-execution Three independent project namespaces share the existing prepared public native source and cache. Four descriptor generations and repeated freshness/cache checks are real additional work; no new installation, source fixture copy or private compiler producer is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh projects live outside the Metro source walk under the batch's tools allocation. Only these projects are mutated. The effective environment is restored in finally, while the BatchWorkspace retains files and cache through its existing reader/unknown-closure lifetime and cleanup authority.
 * @evidence contracts/e2e.md#preserved-coverage Existing descriptor/runtime/cache populations remain selected. This adds ordinary stable publication, changed-generation refusal and recovery/replay; direct owning units retain scoped/subpath/conditional/link/failure/metadata controls and the official floor adapter separately proves fallback reachability.
 */
export function mappedResolutionWitnessCorpus(options: {
  workspace: BatchWorkspace.Workspace;
  fixtureSource: string;
  env: NodeJS.ProcessEnv;
}): void {
  const root = path.join(options.workspace.root, "tools/mapped-witness");
  assert.equal(fs.existsSync(root), false);
  fs.mkdirSync(root, { recursive: true });
  const fixtures = path.resolve(
    import.meta.dirname,
    "../../fixtures/ttsc/mapped-resolution-witness",
  );
  const cache = options.workspace.cache;
  const environment: NodeJS.ProcessEnv = {
    TTSC_BINARY: TestProject.TSGO_BINARY,
    TTSC_NODE_BINARY: process.execPath,
    TTSC_CACHE_DIR: cache,
    GOFLAGS: options.env.GOFLAGS,
  };
  const original = Object.fromEntries(
    Object.keys(environment).map((key) => [key, process.env[key]]),
  );
  const apply = (values: NodeJS.ProcessEnv): void => {
    for (const [key, value] of Object.entries(values))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  };
  const failures: unknown[] = [];
  const collect = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const prepare = (name: string, change: boolean) => {
    const cwd = path.join(root, name);
    const descriptor = path.join(cwd, "descriptors/descriptor.cjs");
    const near = path.join(cwd, "descriptors/node_modules/@scope/pkg");
    const far = path.join(cwd, "node_modules/@scope/pkg");
    const counter = path.join(cwd, "evaluations.log");
    fs.mkdirSync(path.dirname(descriptor), { recursive: true });
    fs.mkdirSync(path.dirname(near), { recursive: true });
    fs.mkdirSync(far, { recursive: true });
    fs.copyFileSync(path.join(fixtures, "descriptor.cjs"), descriptor);
    // Keep project discovery separate from the descriptor imports scope.
    fs.copyFileSync(
      path.join(fixtures, "package.json"),
      path.join(cwd, "package.json"),
    );
    fs.copyFileSync(
      path.join(fixtures, "package.json"),
      path.join(path.dirname(descriptor), "package.json"),
    );
    fs.copyFileSync(
      path.join(fixtures, "far-package.json"),
      path.join(far, "package.json"),
    );
    fs.copyFileSync(
      path.join(fixtures, "far-entry.cjs"),
      path.join(far, "index.cjs"),
    );
    const tsconfig = path.join(cwd, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          plugins: [{
            transform: descriptor,
            fixtureSource: options.fixtureSource,
            evaluationCounter: counter,
            nearPackage: near,
            createNear: change,
          }],
        },
      }),
    );
    return { cwd, tsconfig, near, counter };
  };
  try {
    apply(environment);
    assert.equal((process.env.NODE_OPTIONS ?? "").trim(), "");
    collect("stable ordinary capability publication and replay", () => {
      const project = prepare("stable", false);
      const query = () => resolveCapabilityPluginResolution({
        cwd: project.cwd,
        tsconfig: project.tsconfig,
        capability: "probe",
      });
      const first = query();
      assert.equal(first.status, "resolved");
      assert.equal(first.plugins.length, 1);
      assert.equal(first.isCurrent(), true);
      assert.equal(fs.readFileSync(project.counter, "utf8"), "x");
      const file = CapabilityResolutionFormat.resolutionFile(project);
      assert.ok(file && fs.existsSync(file));
      assert.ok(first.plugins[0]!.manifest.includes('"FAR"'));
      assert.equal(query().isCurrent(), true);
      assert.equal(fs.readFileSync(project.counter, "utf8"), "x");
    });
    collect("ordinary loader preserves changed mapped witness refusal", () => {
      const project = prepare("loader-change", true);
      const result = loadProjectPlugins({
        binary: TestProject.TSGO_BINARY,
        cwd: project.cwd,
        file: project.tsconfig,
        cacheDir: cache,
      });
      assert.equal(result.nativePlugins.length, 1);
      assert.equal(result.nativePlugins[0]!.name, "FAR");
      const manifest = path.join(project.near, "package.json");
      assert.ok(fs.existsSync(manifest));
      assert.ok(result.hostInputs.includes(manifest));
      assert.equal(Object.hasOwn(result.hostInputHashes, manifest), false);
      assert.equal(fs.readFileSync(project.counter, "utf8"), "x");
    });
    collect("ordinary capability refusal recovery and replay", () => {
      const project = prepare("capability-change", true);
      const query = () => resolveCapabilityPluginResolution({
        cwd: project.cwd,
        tsconfig: project.tsconfig,
        capability: "probe",
      });
      const changed = query();
      assert.equal(changed.status, "resolved");
      assert.equal(changed.plugins.length, 1);
      assert.ok(changed.plugins[0]!.manifest.includes('"FAR"'));
      assert.equal(changed.isCurrent(), false);
      const file = CapabilityResolutionFormat.resolutionFile(project);
      assert.ok(file);
      assert.equal(fs.existsSync(file), false);
      assert.equal(fs.readFileSync(project.counter, "utf8"), "x");
      const recovered = query();
      assert.equal(recovered.status, "resolved");
      assert.equal(recovered.plugins.length, 1);
      assert.ok(recovered.plugins[0]!.manifest.includes('"NEAR"'));
      assert.equal(recovered.isCurrent(), true);
      assert.ok(fs.existsSync(file));
      assert.equal(fs.readFileSync(project.counter, "utf8"), "xx");
      assert.equal(query().isCurrent(), true);
      assert.equal(fs.readFileSync(project.counter, "utf8"), "xx");
    });
  } finally {
    apply(original);
  }
  if (failures.length)
    throw new AggregateError(failures, "mapped resolution witness corpus");
}
