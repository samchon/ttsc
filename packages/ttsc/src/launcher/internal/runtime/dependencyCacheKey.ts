import crypto from "node:crypto";

/**
 * Derive a dependency build address within its owning run or process cache.
 *
 * A key names one build: a dependency project's whole file set, or with
 * `options.root` one TypeScript root that project's file set does not contain,
 * compiled alone through its options. The two never share a generation.
 *
 * Compiler identity is supplied by the build coordinator after inspecting the
 * actual executable; an unavailable proof uses a fresh identity there.
 *
 * @evidence contracts/common.md#principled-implementation SHA-256 separates project, isolated-root content, emit policy, compiler proof and descriptor process identity with explicit delimiters, so distinct supported build contexts do not intentionally share an address.
 * @evidence contracts/common.md#clear-and-simple-design One key function combines caller-established identity inputs; executable observation and build memo validity remain with the coordinator that knows when a build is requested.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor evaluation uses a random process nonce rather than recycled pids or shared path-only emit that would pair another evaluator's bytes with current input observations.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish project and isolated-root builds, describe compiler proof ownership and explain why descriptor processes cannot reuse each other's generations.
 * @evidence contracts/performance.md#efficient-algorithms Hashing costs O(B) input bytes with constant digest state; the returned 16-hex address is a 64-bit truncation, so it is not a collision-free or security identity.
 * @evidence contracts/performance.md#reuse-equivalent-work Run/process containers scope ordinary module snapshots; the coordinator supplies current compiler proof and isolated-root content, while a process nonce forbids cross-evaluator reuse. A key alone does not validate edited project dependencies.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One random descriptor nonce is retained for the process lifetime; hash objects are call-local and generated directory storage remains with the cache owner.
 */
export function dependencyCacheKey(
  tsconfig: string,
  options: {
    /** Current executable content proof, or a fresh non-reusable identity. */
    compilerIdentity?: string;

    /** Whether this build belongs to descriptor evaluation. */
    descriptorLoad?: boolean;

    /** Evaluator identity; absent selects this process's random nonce. */
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
      .update(`\0compiler:${options.compilerIdentity ?? ""}`)
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
