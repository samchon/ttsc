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
