import crypto from "node:crypto";

/** Derive one dependency cache key; exported for isolation regressions. */
export function dependencyCacheKey(
  tsconfig: string,
  options: {
    descriptorLoad?: boolean;
    descriptorNonce?: string;
  } = {},
): string {
  const descriptorLoad =
    options.descriptorLoad ?? process.env.TTSC_PLUGIN_DESCRIPTOR_LOAD === "1";
  return (
    crypto
      .createHash("sha256")
      .update(tsconfig)
      .update("\0runtime-es2025")
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
