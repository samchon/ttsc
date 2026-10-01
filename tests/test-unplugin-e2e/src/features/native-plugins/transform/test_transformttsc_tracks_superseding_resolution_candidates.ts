import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the transform registers a superseding resolution candidate as a
 * watch input.
 *
 * With `allowJs`, `./value` currently resolves to `value.js`, but TypeScript
 * would prefer `value.ts` if it existed. The absent `value.ts` is therefore an
 * input to this module's resolution, and it must be reported so that creating
 * it recompiles the importer.
 *
 * 1. Create a project where `./value` resolves to `value.js` under `allowJs`.
 * 2. Transform the entry module and collect its watch inputs.
 * 3. Assert the absent `value.ts` candidate is among them.
 * 4. Create `value.ts` and assert the next transform replaces the cached
 *    generation.
 *
 * @evidence contracts/testing.md#behavioral-verification allowJs transform returns undefined but watches missing value.ts; creation returns unchanged transform yet replaces cached generation.
 * @evidence contracts/testing.md#independent-expectations TypeScript prioritizes .ts over .js; authored candidate path and generation identity expose resolution refresh without plugin rewrite.
 * @evidence contracts/testing.md#distinguishing-cases Initial JS winner, absent higher-priority TS path, then candidate creation.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_tracks_superseding_resolution_candidates is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Built transformTtsc coordinates the actual Go fixture envelope with cache delivery for initial JS winner, absent higher-priority TS path, then candidate creation. A fabricated producer result would not establish that native proofs, output and consumer validation agree; portable helper assertions in this body still do not independently require a host.
 * @evidence contracts/e2e.md#shared-execution One project and loaded API share native fixture artifacts through TTSC_CACHE_DIR. Its modules and request waves reuse the local generation until the stated input/proof/lifecycle changes require replacement; the compile counts above are deliberate state boundaries.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/run-log/cache identities isolate this case's writes; immutable fixture Go sources may share artifact cache, while edited producer sources are copied locally. This body has no finally cache-reset guarantee; runner process exit bounds remaining observers and removes tracked roots. Cache-local seams avoid modifying another case's filesystem provider.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: allowJs transform returns undefined but watches missing value.ts; creation returns unchanged transform yet replaces cached generation. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_tracks_superseding_resolution_candidates(): Promise<void> {
  const root = TestUnpluginProject.createProject({
    plugins: [],
    source: 'import { winner } from "./value";\nexport const value = winner;\n',
  });
  const tsconfig = path.join(root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.allowJs = true;
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2), "utf8");
  const file = TestUnpluginProject.mainFile(root);
  const candidate = path.join(root, "src", "value.ts");
  fs.writeFileSync(
    path.join(root, "src", "value.js"),
    "export function winner() {}\n",
    "utf8",
  );

  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const cache = createTtscTransformCache();
  const watched: string[] = [];
  const first = await transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    resolveOptions({ project: tsconfig }),
    undefined,
    cache,
    { addWatchFile: (input: string) => watched.push(input) },
  );
  assert.equal(first, undefined);
  assert.ok(
    watched.includes(candidate),
    `missing higher-priority candidate from watch inputs: ${watched.join(", ")}`,
  );
  assert.equal(cache.size, 1);
  const firstGeneration = [...cache.values()][0];

  fs.writeFileSync(candidate, "export function winner(): void {}\n", "utf8");
  const second = await transformTtsc(
    file,
    fs.readFileSync(file, "utf8"),
    resolveOptions({ project: tsconfig }),
    undefined,
    cache,
  );
  assert.equal(second, undefined);
  assert.notStrictEqual(
    [...cache.values()][0],
    firstGeneration,
    "creating a superseding candidate must replace the cached generation",
  );
}
