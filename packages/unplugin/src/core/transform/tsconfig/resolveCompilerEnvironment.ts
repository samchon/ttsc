/**
 * Capture one invocation's environment and explicit content-mapper permission.
 *
 * Omission preserves inherited arguments. An explicit boolean appends its
 * upstream assignment after inherited arguments, keeping their order and cwd.
 * Invalid transport fails instead of discarding inherited choices.
 *
 * @evidence contracts/common.md#principled-implementation A detached environment and ordered JSON argv preserve inherited choices; an explicit boolean assignment has final precedence.
 * @evidence contracts/common.md#clear-and-simple-design Capture happens before cache selection; scratch routing derives a child copy afterward.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No process global or compiler behavior is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native prose documents omission, precedence, cwd and invalid transport.
 * @evidence contracts/portability.md#os-neutral-implementation Windows environment names follow their native case-insensitive rule; POSIX names remain exact. JSON preserves argv without shell syntax.
 * @evidence contracts/performance.md#efficient-algorithms Copying visits environment keys; Windows normalization scans them once, and an explicit permission parses and serializes argument bytes once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every invocation observes current inherited values; cache owners compare its snapshot.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The detached result transfers to its caller and acquires no handle or history.
 */
export function resolveCompilerEnvironment(
  runExternalCode?: boolean,
  inherited: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...inherited };
  if (process.platform === "win32") {
    const selected = new Map<
      string,
      { key: string; value: string | undefined }
    >();
    for (const key of Object.keys(env)) {
      const name = key.toUpperCase();
      if (name === "TTSC_TSGO_ARGS" || name === "TTSC_TSGO_ARGS_CWD") {
        const prior = selected.get(name);
        if (prior === undefined || key < prior.key)
          selected.set(name, { key, value: env[key] });
        delete env[key];
      }
    }
    for (const [name, value] of selected) env[name] = value.value;
  }
  // Own absent channels too: a later process.env edit must not become a new
  // inherited argument between this cache lookup and the compiler spawn.
  env.TTSC_TSGO_ARGS = env.TTSC_TSGO_ARGS;
  env.TTSC_TSGO_ARGS_CWD = env.TTSC_TSGO_ARGS_CWD;
  if (runExternalCode === undefined) return env;
  if (typeof runExternalCode !== "boolean")
    throw new TypeError("@ttsc/unplugin: runExternalCode must be a boolean");
  // Go's environment transport trims Unicode White_Space, which excludes BOM.
  const raw = env.TTSC_TSGO_ARGS?.replace(
    /^\p{White_Space}+|\p{White_Space}+$/gu,
    "",
  );
  const args: unknown = raw === undefined || raw === "" ? [] : JSON.parse(raw);
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string"))
    throw new TypeError(
      "@ttsc/unplugin: TTSC_TSGO_ARGS must be a JSON string array",
    );
  env.TTSC_TSGO_ARGS = JSON.stringify([
    ...args,
    "--runExternalCode",
    String(runExternalCode),
  ]);
  return env;
}
