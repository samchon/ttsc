import crypto from "node:crypto";

/**
 * Derive one dependency cache key; exported for isolation regressions.
 *
 * A key names one build: a dependency project's whole file set, or with
 * `options.root` one TypeScript root that project's file set does not contain,
 * compiled alone through its options. The two never share a generation.
 */
export function dependencyCacheKey(
  tsconfig: string,
  options: {
    descriptorLoad?: boolean;
    descriptorNonce?: string;
    /**
     * The single root a root build compiles, with the digest of its content;
     * absent for a project build.
     */
    root?: string;
  } = {},
): string {
  const descriptorLoad =
    options.descriptorLoad ?? process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1";
  return (
    crypto
      .createHash("sha256")
      .update(tsconfig)
      .update("\0runtime-es2025")
      .update(options.root === undefined ? "" : `\0root:${options.root}`)
      // Descriptor evaluation promises a result bound to this process's exact
      // input observations. Reusing an emit another evaluator built can pair
      // that process's old source/config bytes with this process's later hashes.
      // Keep ordinary ttsx worker sharing, but isolate descriptor builds with a
      // non-reusable process nonce; the in-process `builtProjects` map still
      // compiles each owning project once.
      .update(
        descriptorLoad
          ? `\0descriptor-process:${
              options.descriptorNonce ?? descriptorProcessCacheNonce
            }`
          : "",
      )
      .digest("hex")
      .slice(0, 16)
  );
}

// A descriptor evaluator's dependency emit must never be reused by another
// process. PIDs are eventually recycled while the disk cache persists, so PID
// alone cannot provide that isolation. One cryptographically random process
// nonce keeps every evaluator generation distinct while `builtProjects` still
// shares repeated imports inside this process.
const descriptorProcessCacheNonce = crypto.randomBytes(16).toString("hex");
