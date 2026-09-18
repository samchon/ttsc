import os from "node:os";
import path from "node:path";
import { RuntimeManifestRegistry } from "./RuntimeManifestRegistry";

/**
 * The directory dependency builds are cached under.
 *
 * A plugin-descriptor evaluator keeps its builds beside its own result file, so
 * the parent's cleanup of that evaluation removes them too. Otherwise the first
 * manifest's per-run `depCacheDir` is used, shared by every process of one run.
 * Without any manifest the shared `os.tmpdir()/ttsx-dep` is the fallback.
 *
 * @param env Environment to read the descriptor-evaluation variables from.
 */
export function dependencyCacheRoot(
  env: NodeJS.ProcessEnv = process.env,
): string {
  // Descriptor evaluators are disposable and must not leave one isolated emit
  // generation in the shared temp cache per load. Their result file already
  // lives in the evaluator-owned directory that the parent removes in
  // `finally`; put dependency emits beside it so that cleanup owns both.
  if (
    env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1" &&
    typeof env.TTSC_PLUGIN_DESCRIPTOR_OUT === "string" &&
    path.isAbsolute(env.TTSC_PLUGIN_DESCRIPTOR_OUT)
  ) {
    return path.join(
      path.dirname(env.TTSC_PLUGIN_DESCRIPTOR_OUT),
      "dependency-cache",
    );
  }
  const owner = RuntimeManifestRegistry.runtimeManifests().find(
    (candidate) => candidate.depCacheDir.length !== 0,
  );
  return owner !== undefined
    ? owner.depCacheDir
    : path.join(os.tmpdir(), "ttsx-dep");
}
