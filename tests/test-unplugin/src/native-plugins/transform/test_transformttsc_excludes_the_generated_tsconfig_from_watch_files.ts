import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";
import { fixtureHostInputs } from "../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies the generated temp-directory tsconfig never registers as a watch
 * input.
 *
 * A `compilerOptions` overlay makes the adapter compile through a generated
 * tsconfig in the system temp directory. The host's graph lists that file in
 * its config chain, but it is disposed right after the compile, so registering
 * it would invalidate every persistent snapshot on the next build.
 *
 * 1. Transform with a `compilerOptions` overlay and a graph that echoes the
 *    generated tsconfig.
 * 2. Record every registered watch file.
 * 3. Assert only the real type edge and the universal inputs were registered.
 */
export async function test_transformttsc_excludes_the_generated_tsconfig_from_watch_files(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: { removeComments: true },
      plugins: emitGraphPlugins({
        echoTsconfig: true,
        edges: { "src/main.ts": ["src/types.d.ts"] },
      }),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  // The type edge still registers; the echoed temp-dir tsconfig must not.
  assert.deepEqual(
    [...watched].sort(),
    [path.join(root, "src", "types.d.ts"), ...fixtureHostInputs(root)].sort(),
  );
}
