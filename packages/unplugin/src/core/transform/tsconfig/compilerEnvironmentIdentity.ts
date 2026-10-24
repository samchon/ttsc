/**
 * Identify the argument transport in a normalized invocation snapshot.
 *
 * @evidence contracts/common.md#principled-implementation The ordered pair retains raw argv and cwd; absence differs from explicit empty argv.
 * @evidence contracts/common.md#clear-and-simple-design All cache owners use this transport projection, separate from capture.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No argument is dropped based on a consumer or expected output.
 * @evidence contracts/common.md#meaningful-documentation The headline states the normalized-snapshot premise and transport scope.
 * @evidence contracts/portability.md#os-neutral-implementation resolveCompilerEnvironment normalizes native environment names; cwd spelling and JSON argv remain unchanged.
 * @evidence contracts/performance.md#efficient-algorithms Serialization scans two transport strings and allocates their encoded bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This projection owns no cache or shared operation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned string escapes the call.
 */
export function compilerEnvironmentIdentity(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return JSON.stringify([
    env.TTSC_TSGO_ARGS ?? null,
    env.TTSC_TSGO_ARGS_CWD ?? null,
  ]);
}
