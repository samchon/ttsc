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
 *
 * @evidence contracts/testing.md#behavioral-verification The native fixture accepts relative configFile forwarding and returns PLUGIN; its hostInputHashes must include a string proof for the same physical file. Rewriting that file must replace the cached generation, and an omitHostInputProof fixture must reject naming content-proof-missing and fixture.config.json.
 * @evidence contracts/testing.md#independent-expectations The native assert-config-file-path operation validates its received spelling, while literal output, physical file identity, nonidentical generation objects and the deliberate missing-proof diagnostic independently specify behavior. This does not derive expected hash bytes from the adapter.
 * @evidence contracts/testing.md#distinguishing-cases Initial proven forwarding, same path with changed content, and a fresh cache receiving an unproved configFile exercise three states. Missing proof cannot borrow the successful cache, and the legacy config path case owns linked-root spelling.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_absolutizes_relative_plugin_configfile_paths_in_generated_tsconfig in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation. The proven initial/edit pair intentionally shares one cache; a second cache with changed omitHostInputProof options is necessary to establish a genuinely unproved native envelope.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The consumer root is unique, physical comparison only normalizes the asserted file identity, and config bytes change before replacement. The missing-proof case has its own cache/options, so prior proof cannot hide it. Neither cache is explicitly reset here; resources and temporary paths end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_absolutizes_relative_plugin_configfile_paths_in_generated_tsconfig; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
