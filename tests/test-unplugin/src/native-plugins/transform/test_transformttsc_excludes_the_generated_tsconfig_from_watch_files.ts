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
 *
 * @evidence contracts/testing.md#behavioral-verification Native graph echoing the temporary overlay config registers only the real type edge and universal inputs.
 * @evidence contracts/testing.md#independent-expectations The handwritten type-edge topology and literal fixture host inputs establish the exact expected list; no producer-reported list is used as the expected result.
 * @evidence contracts/testing.md#distinguishing-cases Generated disposable config is excluded while real dependency/config/source inputs stay watched.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_excludes_the_generated_tsconfig_from_watch_files in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native graph echoing the temporary overlay config registers only the real type edge and universal inputs. These assertions remain in test_transformttsc_excludes_the_generated_tsconfig_from_watch_files, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
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
