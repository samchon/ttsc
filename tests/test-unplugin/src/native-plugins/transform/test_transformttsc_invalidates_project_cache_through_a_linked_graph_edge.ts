import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies an in-root filesystem link remains outside the project-walk hash
 * universe and a same-content target retarget invalidates a cached generation.
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
