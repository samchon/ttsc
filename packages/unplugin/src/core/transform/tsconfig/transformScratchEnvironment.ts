/** Route all compiler/plugin scratch to one owned directory outside project. */
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
