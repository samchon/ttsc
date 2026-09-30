import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies a bundler alias map is forwarded to the compile as absolute
 * `compilerOptions.paths` targets.
 *
 * The generated tsconfig lives in the temp directory, where TypeScript-Go
 * rejects bare relative targets (TS5090), so the overlay writes absolute ones.
 * Plugin options sit at the entry's top level, because the protocol forwards
 * the whole `compilerOptions.plugins[i]` entry as the plugin's config; a nested
 * `config` object would make the fixture fall back to its default operation and
 * never assert. A `find` written with a trailing slash reaches the compile
 * under the same key as a slashless one (samchon/ttsc#1315).
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform with an alias map through the fixture's `assert-paths` operation,
 *    naming the expected absolute target.
 * 3. Assert the transform succeeds, and a trailing-slash `find` produces the same
 *    key.
 *
 * @evidence contracts/testing.md#behavioral-verification Native assert-paths accepts absolute alias target for object alias and slash-terminated array alias, returning PLUGIN both times.
 * @evidence contracts/testing.md#independent-expectations Literal configured target/key are independently validated by the native fixture operation before marker publication.
 * @evidence contracts/testing.md#distinguishing-cases Object @lib and array @trail/ normalize to expected compiler keys; absolute target avoids temporary-directory rebasing.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_passes_bundler_aliases_through_compileroptions_paths in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API loads the actual consumer descriptor and passes generated options through the native fixture host into returned output and adapter hooks. The fixture validates received paths/options or publishes deliberate effects; direct option derivation cannot prove that process connection.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject reuses its immutable Go fixture source and shared content-addressed producer build cache while allocating this consumer independently. Its module requests reuse the supplied transform cache where present; different aliases or producer options legitimately select another transform, without reinstalling the workspace packages.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Native assert-paths accepts absolute alias target for object alias and slash-terminated array alias, returning PLUGIN both times. These assertions remain in test_transformttsc_passes_bundler_aliases_through_compileroptions_paths, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_passes_bundler_aliases_through_compileroptions_paths(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "assert-paths",
          key: "@lib",
          target: path.join(root, "src", "modules").replace(/\\/g, "/"),
        },
      ],
    }),
    { "@lib": path.join(root, "src", "modules") },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);

  // A `find` written with a trailing slash keeps today's outcome, which
  // samchon/ttsc#1315 asks for by name: the slash is stripped, so `"@trail/"`
  // reaches the compile under the key `"@trail"` and its `"@trail/*"` wildcard,
  // the same pair a slashless `find` produces. Left unpinned, a reader could
  // reasonably think the two spellings give different keys.
  const trailing = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "assert-paths",
          key: "@trail",
          target: path.join(root, "src", "modules").replace(/\\/g, "/"),
        },
      ],
    }),
    [{ find: "@trail/", replacement: path.join(root, "src", "modules") }],
  );
  assert.ok(trailing);
  assert.match(trailing.code, /"PLUGIN"/);
}
