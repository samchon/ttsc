import { clearInheritedSemanticConfigPath } from "./clearInheritedSemanticConfigPath";
import { clearInheritedTsgoArgs } from "./clearInheritedTsgoArgs";
import { publishLinkedTransformPlugins } from "./publishLinkedTransformPlugins";
import { SidecarEnvironment } from "./SidecarEnvironment";

/**
 * Merge inherited and caller environments with native variable-name identity,
 * then clear per-invocation payloads this lane never published: forwarded tsgo
 * arguments, semantic config ownership and the linked-plugin manifest.
 *
 * Use it at every spawn whose child can reach `driver.LoadProgram` — the
 * `api-compile` / `api-transform` hosts, and the plugin loader, whose `ttsx`
 * descriptor evaluation compiles a project of its own. One rule at every site
 * beats four sites each reasoning about whether the variable could be present.
 *
 * `tsgoBinary` is the caller's explicit TypeScript-Go executable. It wins over
 * an inherited or caller `TTSC_TSGO_BINARY`, as it does in `resolveTsgo`, so a
 * child never compiles with another compiler than the invocation chose.
 *
 * @evidence contracts/common.md#principled-implementation Native-aware layer merging gives caller values precedence over inherited values and the explicit compiler final authority; unrelated invocation channels are then cleared or restored from the caller's own declarations.
 * @evidence contracts/common.md#clear-and-simple-design One constructor serves compile, transform and descriptor-evaluation children, with each channel's ownership policy delegated to its named helper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A fresh explicit environment carries selected authority without mutating process.env, patching spawn behavior or guessing a compiler from the outer sidecar's identity.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe consumers, per-invocation cleanup and explicit compiler precedence following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The shared merge treats Windows names case-insensitively across layers while POSIX names retain exact spelling; cleanup follows that same native identity rule.
 * @evidence contracts/performance.md#efficient-algorithms Environment construction and the fixed set of channel operations cost O(E) name processing plus key lengths, with O(E) returned storage; no subprocess probe is needed for environment identity.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Per-invocation environment authority changes and the returned object is mutable; no stable equivalent-request producer authorizes shared objects.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The new environment transfers to the spawning caller without retaining outer payloads or environment history in this module.
 */
export function inheritedSidecarEnv(
  callerEnv: NodeJS.ProcessEnv | undefined,
  tsgoBinary?: string,
): NodeJS.ProcessEnv {
  const env = SidecarEnvironment.merge(
    process.env,
    callerEnv,
    tsgoBinary === undefined ? undefined : { TTSC_TSGO_BINARY: tsgoBinary },
  );
  clearInheritedTsgoArgs(env, callerEnv);
  clearInheritedSemanticConfigPath(env, callerEnv);
  publishLinkedTransformPlugins(env, callerEnv, []);
  return env;
}
