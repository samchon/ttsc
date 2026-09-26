import { clearInheritedSemanticConfigPath } from "./clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "./clearInheritedTsgoArgs";
import { publishLinkedTransformPlugins } from "./publishLinkedTransformPlugins";

/**
 * The `{ ...process.env, ...callerEnv }` a child process inherits, minus the
 * per-invocation payloads this lane never published: a forwarded-tsgo payload
 * and a linked-plugin manifest.
 *
 * Use it at every spawn whose child can reach `driver.LoadProgram` — the
 * `api-compile` / `api-transform` hosts, and the plugin loader, whose `ttsx`
 * descriptor evaluation compiles a project of its own. One rule at every site
 * beats four sites each reasoning about whether the variable could be present.
 *
 * `tsgoBinary` is the caller's explicit TypeScript-Go executable. It wins over
 * an inherited or caller `TTSC_TSGO_BINARY`, as it does in `resolveTsgo`, so a
 * child never compiles with another compiler than the invocation chose.
 */
export function inheritedSidecarEnv(
  callerEnv: NodeJS.ProcessEnv | undefined,
  tsgoBinary?: string,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...callerEnv };
  if (tsgoBinary !== undefined) env.TTSC_TSGO_BINARY = tsgoBinary;
  clearInheritedTsgoArgs(env, callerEnv);
  clearInheritedSemanticConfigPath(env, callerEnv);
  publishLinkedTransformPlugins(env, callerEnv, []);
  return env;
}
