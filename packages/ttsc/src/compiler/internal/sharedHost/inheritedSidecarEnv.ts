import { clearInheritedTsgoArgs } from "./clearInheritedTsgoArgs";
import { clearInheritedSemanticConfigPath } from "./clearInheritedSemanticConfigPath";

/**
 * The `{ ...process.env, ...callerEnv }` a child process inherits, minus a
 * forwarded-tsgo payload this lane never published.
 *
 * Use it at every spawn whose child can reach `driver.LoadProgram` — the
 * `api-compile` / `api-transform` hosts, and the plugin loader, whose `ttsx`
 * descriptor evaluation compiles a project of its own. One rule at every site
 * beats four sites each reasoning about whether the variable could be present.
 */
export function inheritedSidecarEnv(
  callerEnv: NodeJS.ProcessEnv | undefined,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...callerEnv };
  clearInheritedTsgoArgs(env, callerEnv);
  clearInheritedSemanticConfigPath(env, callerEnv);
  return env;
}
