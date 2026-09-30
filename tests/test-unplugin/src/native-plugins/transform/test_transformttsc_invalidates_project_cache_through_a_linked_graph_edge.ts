import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies an in-root link stays outside the project walk, and a same-content
 * retarget invalidates the generation.
 *
 * A link inside the project root is an out-of-walk input: the walk never
 * follows it, so it must be proven through the graph under its lexical
 * spelling. Retargeting it to a byte-identical file still changes what the
 * compiler read, because the physical identity moved, even though no content
 * comparison would see it.
 *
 * 1. Assert the walk predicate excludes the link and a missing path, and includes
 *    the real entry.
 * 2. Transform through a graph edge to the link, and assert watch registration
 *    keeps the lexical spelling and the host published a content proof.
 * 3. Assert an unchanged retransform reuses the generation, and a retarget to
 *    identical content replaces it.
 *
 * @evidence contracts/testing.md#behavioral-verification Real/missing/link walk distinctions, lexical watch registration, content/realpath proofs, unchanged reuse and same-byte link retarget invalidation remain asserted.
 * @evidence contracts/testing.md#independent-expectations BOM-stripped literal declaration sets the supplied content proof; native realpath independently identifies targets and watcher closure prevents relying only on events.
 * @evidence contracts/testing.md#distinguishing-cases In-root link remains outside the walk; identical bytes at a different physical target must invalidate while unchanged target reuses.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_invalidates_project_cache_through_a_linked_graph_edge in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Real/missing/link walk distinctions, lexical watch registration, content/realpath proofs, unchanged reuse and same-byte link retarget invalidation remain asserted. These assertions remain in test_transformttsc_invalidates_project_cache_through_a_linked_graph_edge, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_invalidates_project_cache_through_a_linked_graph_edge(): Promise<void> {
  const {
    isProjectWalkPath,
    resolveOptions,
    transformTtsc,
    createTtscTransformCache,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const targetRoot = path.join(root, "targets");
  const firstTarget = path.join(targetRoot, "first");
  const secondTarget = path.join(targetRoot, "second");
  const declaration = "\ufeffdeclare const selected: string;\n";
  const compilerText = declaration.slice(1);
  fs.mkdirSync(firstTarget, { recursive: true });
  fs.mkdirSync(secondTarget);
  fs.writeFileSync(path.join(firstTarget, "types.d.ts"), declaration, "utf8");
  fs.writeFileSync(path.join(secondTarget, "types.d.ts"), declaration, "utf8");
  const linkedDirectory = path.join(root, "linked");
  fs.symlinkSync(
    firstTarget,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = path.join(linkedDirectory, "types.d.ts");
  assert.equal(isProjectWalkPath(root, linked), false);
  assert.equal(
    isProjectWalkPath(root, path.join(root, "src", "missing.d.ts")),
    false,
  );
  assert.equal(
    isProjectWalkPath(root, TestUnpluginProject.mainFile(root)),
    true,
  );

  const options = resolveOptions({
    plugins: emitGraphPlugins({
      edges: { "src/main.ts": ["linked/types.d.ts"] },
      inputHashes: {
        "linked/types.d.ts": crypto
          .createHash("sha256")
          .update(compilerText)
          .digest("hex"),
      },
    }),
  });
  const cache = createTtscTransformCache();
  const watched: string[] = [];
  const before = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.ok(before);
  assert.ok(
    watched.includes(linked),
    "watch registration must preserve the lexical linked input",
  );
  const generation = [...cache.values()][0]!;
  const generationState = await generation;
  assert.equal(generationState.result.type, "success");
  const linkedProofHash =
    generationState.result.graph?.inputHashes?.["linked/types.d.ts"];
  assert.ok(
    typeof linkedProofHash === "string" &&
      /^[0-9a-f]{64}$/.test(linkedProofHash),
    "synthetic graph host must publish a content proof for the linked input",
  );
  assert.equal(
    generationState.result.graph?.inputRealpaths?.["linked/types.d.ts"],
    fs.realpathSync.native(linked),
  );

  const unchanged = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(unchanged);
  assert.strictEqual([...cache.values()][0], generation);

  // Notifications are advisory. Close both trackers so the next assertion
  // specifically proves the compiler-time selected-realpath fingerprint.
  generationState.projectMutationTracker?.close();
  generationState.hostInputMutationTracker?.close();
  fs.rmSync(linkedDirectory, { force: true, recursive: true });
  fs.symlinkSync(
    secondTarget,
    linkedDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const after = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );
  assert.ok(after);
  assert.notStrictEqual([...cache.values()][0], generation);
}
