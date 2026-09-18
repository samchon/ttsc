import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies that a bundler alias map passed as the fourth argument to
 * `transformTtsc` is forwarded to the ttsc transform as
 * `compilerOptions.paths`, verified by the fixture plugin's `assert-paths`
 * operation. The expected target is the absolute alias replacement: the
 * generated tsconfig lives in a temp directory where TypeScript-Go rejects bare
 * relative targets (TS5090), so the overlay writes absolute ones.
 *
 * Plugin options sit at the entry top level — the protocol forwards the whole
 * `compilerOptions.plugins[i]` entry as the plugin's config object, so a nested
 * `config: {...}` object would make the fixture fall back to its default
 * operation and the assertion would never run.
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
