import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a relative plugin `configFile` is absolutized in the generated
 * tsconfig and proven as a generation input.
 *
 * `configFile` is the override the shipped utility plugins accept. The
 * generated tsconfig lives in a temp directory, so a relative path left as
 * written would resolve there and read nothing. The file is also a compiler
 * input, so editing it must replace the generation, while a forwarded file the
 * native host reports no evidence for cannot be proven at all.
 *
 * 1. Transform with a relative `configFile`, and assert the fixture plugin
 *    received its absolute path.
 * 2. Edit the config file and assert the next transform replaces the generation.
 * 3. Forward a `configFile` the host reports no content proof for, and assert the
 *    transform rejects naming it.
 */
export async function test_transformttsc_absolutizes_relative_plugin_configfile_paths_in_generated_tsconfig(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  fs.writeFileSync(
    path.join(root, "fixture.config.json"),
    JSON.stringify({ ok: true }),
    "utf8",
  );
  const cache = createTtscTransformCache();
  const options = resolveOptions({
    compilerOptions: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          configFile: "./fixture.config.json",
          operation: "assert-config-file-path",
        },
      ],
    },
  });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    options,
    undefined,
    cache,
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  const configFile = path.join(root, "fixture.config.json");
  const firstGeneration = await [...cache.values()][0]!;
  // The native host reports the input as the compiler handed it, spelled under
  // the project's physical directory (samchon/ttsc#1456), so it is found by
  // identity; a candidate the host probed may not exist.
  const physical = (file: string): string => {
    try {
      return fs.realpathSync.native(file);
    } catch {
      return path.resolve(file);
    }
  };
  const reported = Object.entries(
    firstGeneration.result.type === "exception"
      ? {}
      : (firstGeneration.result.hostInputHashes ?? {}),
  ).find(([input]) => physical(input) === physical(configFile));
  assert.equal(
    typeof reported?.[1],
    "string",
    "the native consumer must satisfy the forwarded configFile proof",
  );

  fs.writeFileSync(configFile, JSON.stringify({ ok: false }), "utf8");
  assert.ok(
    await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      options,
      undefined,
      cache,
    ),
  );
  assert.notEqual(
    await [...cache.values()][0]!,
    firstGeneration,
    "a configFile edit must replace the proven generation",
  );

  const unproven = createTtscTransformCache();
  await assert.rejects(
    () =>
      transformTtsc(
        TestUnpluginProject.mainFile(root),
        TestUnpluginProject.mainSource(root),
        resolveOptions({
          compilerOptions: {
            plugins: [
              {
                transform: "./plugin.cjs",
                name: "fixture",
                configFile: "./fixture.config.json",
                omitHostInputProof: true,
                operation: "assert-config-file-path",
              },
            ],
          },
        }),
        undefined,
        unproven,
      ),
    /content-proof-missing[\s\S]*fixture\.config\.json/,
    "a forwarded configFile without native evidence must remain uncacheable",
  );
}
