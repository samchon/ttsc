import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { primeSuccessfulTransform } from "../../internal/transform-project-cache/primeSuccessfulTransform";

/**
 * Verifies a resolved host-`"exception"` envelope is surfaced and evicted.
 *
 * A generation can also fail by resolving to an `ITtscCompilerTransformation`
 * whose `type` is `"exception"`, which makes `selectTransformedSource` throw.
 * That is a failed generation too and must not be retained, or a long-lived
 * worker replays the exception forever. Reusing the primed generation's project
 * root and input hashes keeps `matchesCachedSource` passing so control reaches
 * the exception path.
 */
export async function test_transformttsc_evicts_a_host_exception_transform_and_recovers(): Promise<void> {
  // Share one Go fixture build per process; transformTtsc shells out to it.
  TestUnpluginProject.ensureSharedCacheDir();
  const { api, cache, key, good, file, source, options } =
    await primeSuccessfulTransform();
  const projectRoot = (good as { projectRoot: string }).projectRoot;
  const scratchDirectory = (good as { scratchDirectory: string })
    .scratchDirectory;
  const falseDiagnostic = path.resolve(projectRoot, "foo.ts");
  const externalInputPaths = (good as { externalInputPaths: string[] })
    .externalInputPaths;
  const targetInput = externalInputPaths.find((input) => {
    try {
      return fs.statSync(input).isFile();
    } catch {
      return false;
    }
  });
  assert.ok(
    targetInput,
    "the primed generation must expose a regular external input for aliasing",
  );
  const targetDirectory = path.dirname(targetInput);
  const aliasDirectories = ["failure-watch-a", "failure-watch-b"].map((name) =>
    path.join(projectRoot, "node_modules", name),
  );
  fs.mkdirSync(path.dirname(aliasDirectories[0]!), { recursive: true });
  for (const alias of aliasDirectories) {
    fs.symlinkSync(
      targetDirectory,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const aliasInputs = aliasDirectories.map((alias) =>
    path.join(alias, path.basename(targetInput)),
  );
  assert.equal(
    fs.realpathSync.native(aliasInputs[0]!),
    fs.realpathSync.native(aliasInputs[1]!),
    "the failure-watch aliases must share one current physical target",
  );
  const scratchInput = path.join(scratchDirectory, "owned.tmp");
  const watched: string[] = [];

  cache.set(
    key,
    Promise.resolve({
      ...(good as Record<string, unknown>),
      externalInputPaths: [...externalInputPaths, ...aliasInputs],
      result: {
        type: "exception",
        error: new Error(
          `${scratchInput}:1:2 - error TS9000: scratch failure\nfoo.ts:1:2 - error while loading\nhost exploded`,
        ),
      },
    }),
  );

  await assert.rejects(
    () =>
      api.transformTtsc(file, source, options, undefined, cache, {
        addWatchFiles(inputs: readonly { file: string }[]) {
          watched.push(...inputs.map((input) => input.file));
        },
      }),
    /host exploded/,
  );
  assert.ok(
    !watched.includes(falseDiagnostic),
    `a generic exception line must not manufacture a diagnostic watch path; watched: ${watched.join(", ")}`,
  );
  assert.deepEqual(
    aliasInputs.filter((input) => watched.includes(input)),
    aliasInputs,
    "a failed generation must preserve every independently retargetable lexical alias",
  );
  assert.ok(
    !watched.includes(scratchInput),
    "a failed generation must not register its disposed scratch tree",
  );
  assert.equal(cache.size, 0, "resolved-exception generation must not persist");

  const recovered = await api.transformTtsc(
    file,
    source,
    options,
    undefined,
    cache,
  );
  assert.ok(recovered, "corrected retry must re-run the transform");
  TestUnpluginProject.assertTransformedToPlugin(recovered.code);
  assert.equal(cache.size, 1);
}
