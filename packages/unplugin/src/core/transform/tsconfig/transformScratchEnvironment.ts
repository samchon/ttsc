/**
 * The environment a compile runs under: the host's own, with `TEMP`, `TMP`, and
 * `TMPDIR` naming the compile's scratch directory. Consumers honoring these
 * variables use that temporary root; explicit paths or overridden child
 * environments are not confined by these settings.
 *
 * Capture hands this copy to the compiler as `env` (samchon/ttsc#1488); applying
 * it to workers and inherited child environments belongs to the compiler host.
 * This function leaves the host's own environment unchanged.
 *
 * @param directory The compile's scratch directory.
 *
 * @evidence contracts/common.md#principled-implementation A copied environment preserves host settings and supplies three temporary-root overrides to capture's compiler request. This routes cooperating consumers, not arbitrary plugin writes or independently overridden child environments.
 * @evidence contracts/common.md#clear-and-simple-design One environment object expresses the child-process override without mutating process globals or introducing platform-specific execution wrappers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Temporary routing changes only the launched compile's environment, avoiding global monkeypatches or project-local scratch that would contaminate watched inputs.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify the child-process propagation boundary and explicitly distinguish it from changing the host environment.
 * @evidence contracts/portability.md#os-neutral-implementation All three native temporary-directory variables receive the same owned directory, covering Windows and Unix child consumers without constructing shell syntax or mutating the host environment.
 * @evidence contracts/performance.md#efficient-algorithms
 *   The spread enumerates K process environment keys/values into a fresh object
 *   before three assignments. Key/value text and native environment retrieval
 *   contribute costs; absence of an explicit loop is not constant work.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Each call copies current host settings and one owner's temporary address;
 *   equal directory strings do not prove unchanged environment observations.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function transformScratchEnvironment(
  directory: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TEMP: directory,
    TMP: directory,
    TMPDIR: directory,
  };
}
