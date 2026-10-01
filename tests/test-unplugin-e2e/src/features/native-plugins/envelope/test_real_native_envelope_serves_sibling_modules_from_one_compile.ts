import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { observeReloadEvents } from "../../../internal/adapter-vite-serve/observeReloadEvents";
import type { IRealNativeEnvelopeApi } from "../../../internal/real-native-envelope/IRealNativeEnvelopeApi";
import type { IRealNativeEnvelopeFixture } from "../../../internal/real-native-envelope/IRealNativeEnvelopeFixture";
import { assertProductionEnvelope } from "../../../internal/real-native-envelope/assertProductionEnvelope";
import { createRealNativeEnvelopeFixture } from "../../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { deliver } from "../../../internal/real-native-envelope/deliver";
import { loadApi } from "../../../internal/real-native-envelope/loadApi";
import { programRuns } from "../../../internal/real-native-envelope/programRuns";
import { resetRunLog } from "../../../internal/real-native-envelope/resetRunLog";
import { waitFor } from "../../../internal/real-native-envelope/waitFor";

/**
 * Verifies the real native host serves every sibling module from one compile,
 * in the core cache and through Vite serve.
 *
 * The production envelope, not a synthetic one, is what persistent and
 * build-scoped delivery must reuse. Vite adds its own module graph and
 * file-change channel on top, so the adapter's wiring has to keep one host
 * invocation across siblings, preserve cached transforms across unchanged
 * polls, and invalidate only the importers a changed predicate owns.
 *
 * 1. Deliver every module through the core cache, persistent and build-scoped, and
 *    assert one host invocation each.
 * 2. Serve the fixture through Vite and assert sibling requests share one
 *    invocation, and unchanged polls keep every cached transform.
 * 3. Turn a candidate directory into a file and assert only its importer is
 *    invalidated, a full reload is announced, and nothing recompiles until Vite
 *    requests it again.
 *
 * @evidence contracts/testing.md#behavioral-verification Core persistent and build-scoped deliveries require one native invocation across siblings and a real production envelope. A live Vite server recovers from initially missing dependencies, caches every sibling, preserves caches during unchanged polls, then invalidates only the predicate importer and emits full-reload when a directory becomes a selectable file, without eagerly compiling.
 * @evidence contracts/testing.md#independent-expectations Contributor log bytes count actual Programs independently of cache decisions. Literal one-invocation expectations, original Vite graph node identities, cached-transform presence and observed full-reload messages distinguish adapter participation from Vite's own TypeScript transpilation. Returned code alone is intentionally insufficient.
 * @evidence contracts/testing.md#distinguishing-cases Persistent versus build-scoped core ownership, missing-dependency recovery versus healthy sibling requests, unchanged polls, and directory-to-file predicate change are separate contributions. Unrelated importers must retain transforms when the predicate importer loses its result; refetch compilation after invalidation is outside this assertion set.
 * @evidence contracts/testing.md#execution-ownership The named native envelope entry delegates to assertCoreLifecycle twice and assertViteLifecycle once; all assertions in those private helpers belong to this discoverable TestExecutor E2E entry. No helper callback is a separately registered case.
 * @evidence contracts/e2e.md#necessary-boundary Actual TypeScript-Go proofs are consumed first by core cache lifetimes and then by Vite's real module graph and HMR channel. This detects absent adapter polling or incorrect importer routing that synthetic envelopes or returned transpiled code cannot distinguish.
 * @evidence contracts/e2e.md#shared-execution One fixture and shared native contributor serve both core lifetimes and the live Vite session. Separate caches establish persistent versus build-scoped ownership; the server adds the necessary real graph/HMR connection. Within each lifetime every sibling shares one Program, and unchanged polling requires no compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each core helper resets its log and owns a cache released in finally. The Vite phase resets the log, deliberately deletes then restores declaration and runtime together, clears recovery events, and retains node identities before the candidate mutation. server.close runs in finally; temporary roots belong to TestProject until runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All core-envelope and sibling-count checks remain in the private core helper, and the Vite helper retains initial rejection/recovery, graph cache, quiet-poll, targeted invalidation, full-reload and no-eager-compile assertions. There is no removed or transferred behavioral check.
 */
export async function test_real_native_envelope_serves_sibling_modules_from_one_compile(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const api = await loadApi();
  await assertCoreLifecycle(api, fixture, false, { strict: true });
  await assertCoreLifecycle(api, fixture, true);
  await assertViteLifecycle(fixture);
}

/** Drive one core cache lifecycle and assert its real envelope before reuse. */
async function assertCoreLifecycle(
  api: IRealNativeEnvelopeApi,
  fixture: IRealNativeEnvelopeFixture,
  buildScoped: boolean,
  compilerOptions?: Record<string, unknown>,
): Promise<void> {
  const cache = api.createTtscTransformCache();
  if (buildScoped) api.beginTtscTransformBuild(cache);
  const options = api.resolveOptions({
    ...(compilerOptions === undefined ? {} : { compilerOptions }),
    project: path.join(fixture.root, "tsconfig.json"),
  });
  resetRunLog(fixture.runLog);
  try {
    await deliver(api, cache, options, fixture.modules[0]!);
    assert.equal(programRuns(fixture.runLog), 1);
    await assertProductionEnvelope(cache, fixture);
    for (const file of fixture.modules.slice(1)) {
      await deliver(api, cache, options, file);
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      `${buildScoped ? "build-scoped" : "persistent"} delivery must serve every sibling module from one production host invocation`,
    );
  } finally {
    api.resetTtscTransformCache(cache);
  }
}

/** Drive the public Vite adapter over the same production-host fixture. */
async function assertViteLifecycle(
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  const { createServer } = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN(
    "vite",
  ) as {
    createServer(config: object): Promise<any>;
  };
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const viteRoot = fs.realpathSync.native(fixture.root);
  resetRunLog(fixture.runLog);
  const declaration = fs.readFileSync(fixture.declaration, "utf8");
  const runtimeFile = path.join(path.dirname(fixture.declaration), "index.js");
  const runtime = fs.readFileSync(runtimeFile, "utf8");
  fs.unlinkSync(fixture.declaration);
  fs.unlinkSync(runtimeFile);
  const server = await createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { include: [], noDiscovery: true },
    plugins: [unpluginVite()],
    root: viteRoot,
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const events = await observeReloadEvents(server);
    await assert.rejects(server.transformRequest("/src/mod0.ts"), /typed-dep/);
    fs.writeFileSync(fixture.declaration, declaration);
    fs.writeFileSync(runtimeFile, runtime);
    await waitFor(
      () => events.length !== 0,
      "initially missing native dependency recovery before refetch",
    );
    events.length = 0;
    const graph =
      server.environments?.client?.moduleGraph ?? server.moduleGraph;
    const entries: Array<{ file: string; node: any }> = [];
    for (const file of fixture.modules) {
      const url = `/${path.relative(fixture.root, file).split(path.sep).join("/")}`;
      const result = await server.transformRequest(url);
      assert.ok(result?.code, `Vite must transform ${url}`);
      const node = await graph.getModuleByUrl(url);
      assert.ok(node, `Vite's module graph must contain ${url}`);
      assert.ok(
        node.transformResult,
        `Vite must cache the first transform result for ${url}`,
      );
      entries.push({ file, node });
    }
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "the Vite serve lifecycle must share one production host invocation across sibling modules",
    );

    await new Promise((resolve) => setTimeout(resolve, 1_100));
    assert.ok(
      entries.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "several unchanged polls must preserve every cached transform",
    );
    assert.equal(
      events.length,
      0,
      "an extension-shaped directory must not be mistaken for an appearing file",
    );

    // Vite can transpile TypeScript even if the ttsc adapter bypasses a module,
    // so returned code alone does not prove the request crossed our transform
    // hook. Replace the exact failed file predicate with a selectable file and
    // require the adapter's private poll to invalidate its importer.
    const predicate = entries.find(({ file }) =>
      file.endsWith("predicate.cts"),
    );
    assert.ok(predicate, "the Vite graph must contain the predicate importer");
    const unrelated = entries.filter((entry) => entry !== predicate);
    fs.rmSync(fixture.fileCandidateDirectory, { recursive: true });
    fs.writeFileSync(
      fixture.fileCandidateDirectory,
      "exports.encode = function encode(value) { return `file:${value}`; };\n",
      "utf8",
    );
    await waitFor(
      () =>
        predicate.node.transformResult === null ||
        predicate.node.transformResult === undefined,
      "the predicate importer to be invalidated after its directory became a file",
    );
    assert.ok(
      unrelated.every(
        ({ node }) =>
          node.transformResult !== null && node.transformResult !== undefined,
      ),
      "the file predicate must invalidate only importers that own it",
    );
    await waitFor(
      () => events.length !== 0,
      "the HMR client to receive a reload",
    );
    assert.ok(
      events.some((event) => event.type === "full-reload"),
      "the directory-to-file transition must announce a full reload",
    );
    assert.equal(
      programRuns(fixture.runLog),
      1,
      "candidate notification must invalidate the importer without compiling until Vite requests it again",
    );
  } finally {
    await server.close();
  }
}
