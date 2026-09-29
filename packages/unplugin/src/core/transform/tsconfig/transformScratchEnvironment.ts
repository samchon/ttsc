/**
 * The environment a compile runs under: the host's own, with `TEMP`, `TMP`, and
 * `TMPDIR` naming the compile's scratch directory, so every temporary file the
 * compiler or a plugin makes lands there and never in the project or a shared
 * temporary tree.
 *
 * It is handed to the compiler as its `env`, which ttsc applies to the worker
 * thread that runs the transform and to every process that transform starts
 * (samchon/ttsc#1488). The host's own environment is never changed.
 *
 * @param directory The compile's scratch directory.
 *
 * @evidence contracts/common.md#principled-implementation A copied environment preserves caller settings while the three standard temporary-directory variables route child compiler and plugin scratch into the generation-owned directory.
 * @evidence contracts/common.md#clear-and-simple-design One environment object expresses the child-process override without mutating process globals or introducing platform-specific execution wrappers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Temporary routing changes only the launched compile's environment, avoiding global monkeypatches or project-local scratch that would contaminate watched inputs.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify the child-process propagation boundary and explicitly distinguish it from changing the host environment.
 * @evidence contracts/portability.md#os-neutral-implementation All three native temporary-directory variables receive the same owned directory, covering Windows and Unix child consumers without constructing shell syntax or mutating the host environment.
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
