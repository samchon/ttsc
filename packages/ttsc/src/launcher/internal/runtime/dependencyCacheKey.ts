import crypto from "node:crypto";

/**
 * Derive a dependency build address within its owning run or process cache.
 *
 * A key addresses one build context: a dependency project's whole file set, or with
 * `options.root` one TypeScript root that project's file set does not contain,
 * compiled alone through its options. Their encodings differ, but the returned
 * 64-bit truncated digest is not a collision-free generation identity.
 *
 * Compiler identity is supplied by the build coordinator after inspecting the
 * actual executable; an unavailable proof uses a fresh identity there.
 *
 * @evidence contracts/common.md#principled-implementation SHA-256 separates project, isolated-root content, plugin loading policy, emit policy, compiler proof and descriptor process identity with explicit delimiters, so distinct supported build contexts do not intentionally share an address.
 * @evidence contracts/common.md#clear-and-simple-design One key function combines caller-established identity inputs; executable observation and build memo validity remain with the coordinator that knows when a build is requested.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Default descriptor evaluation uses a module-instance random nonce rather than a recycled pid or shared path-only address; a supplied nonce remains the coordinator's evaluator-identity responsibility.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish project and isolated-root context encoding, compiler proof ownership and truncated-digest limits; nonce comments distinguish probabilistic evaluator separation from guaranteed uniqueness.
 * @evidence contracts/performance.md#efficient-algorithms Hashing processes B input bytes with fixed digest state; interpolated text and UTF-8 conversion also scale with supplied strings. Module initialization draws the default 16-byte native nonce, whose latency/failure is not bounded by output width. The 16-hex address is a 64-bit truncation, not a collision-free or security identity.
 * @evidence contracts/performance.md#reuse-equivalent-work Run/process containers scope ordinary module snapshots; the coordinator supplies selected plugin policy, current compiler proof and isolated-root content. The supplied or module-instance random nonce separates evaluator encodings probabilistically, not with an absolute noncollision guarantee; a key alone does not validate edited project dependencies.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Module initialization retains one default descriptor nonce while this module instance remains reachable, even when a caller supplies an override. Digest objects and intermediate strings are call-local; generated directory storage remains with the cache owner.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Caller-established filename and option coordinates are opaque text identity inputs here; hashing makes no native path-equivalence, case, alias or process-liveness decision. Native coordinate selection and cache ownership belong to the coordinator.
 */
export function dependencyCacheKey(
  tsconfig: string,
  options: {
    /** Current executable content proof, or a fresh non-reusable identity. */
    compilerIdentity?: string;

    /** Whether this build belongs to descriptor evaluation. */
    descriptorLoad?: boolean;

    /** Evaluator identity; absent selects this module instance's random nonce. */
    descriptorNonce?: string;

    /** Effective false-only plugin loading policy captured for this build. */
    plugins?: false;

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
      .update("\0private-output-volume-root-v1")
      .update(`\0compiler:${options.compilerIdentity ?? ""}`)
      .update(options.plugins === false ? "\0plugins:disabled" : "\0plugins:discover")
      .update(options.root === undefined ? "" : `\0root:${options.root}`)
      // Descriptor evaluation promises a result bound to this process's exact
      // input observations. Reusing an emit another evaluator built can pair
      // that process's old source/config bytes with this process's later hashes.
      // Keep ordinary ttsx worker sharing, but isolate descriptor builds with a
      // probabilistically distinct evaluator nonce; the registry instance's
      // `builtProjects` map still shares an owning project's result.
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

// Descriptor evaluation needs its own input-bound dependency context. Recycled
// pids are not a sufficient key while disk storage persists. One default random
// nonce per module instance reduces accidental evaluator sharing; finite nonce
// and truncated hash widths do not certify collision-free generation identity.
// `builtProjects` still shares repeated imports within its registry instance.
const descriptorProcessCacheNonce = crypto.randomBytes(16).toString("hex");
