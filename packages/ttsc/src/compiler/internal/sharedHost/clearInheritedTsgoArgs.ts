import { TSGO_ARGS_ENV } from "./TSGO_ARGS_ENV";

/**
 * Drop a forwarded-tsgo payload this invocation did not publish itself.
 *
 * Every sidecar env starts from `process.env`, so a ttsc that is itself running
 * inside a plugin sidecar — `@ttsc/lint` evaluating a config file through
 * `ttsx`, for instance — would otherwise hand the outer run's `--strict` to its
 * own sidecars, and `driver.LoadProgram` would apply it. The forwarded argv is
 * per-invocation state the spawning host owns, the same rule
 * `TTSC_PLUGIN_CONFIG_DIR` already follows. A caller that named the variable
 * explicitly keeps it.
 */
export function clearInheritedTsgoArgs(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  if (callerEnv?.[TSGO_ARGS_ENV] === undefined) {
    delete env[TSGO_ARGS_ENV];
  }
}
