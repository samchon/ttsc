import { SEMANTIC_CONFIG_PATH_ENV } from "./SEMANTIC_CONFIG_PATH_ENV";
import { SidecarEnvironment } from "./SidecarEnvironment";

/**
 * Remove an outer wrapper's config owner, retaining only a caller-named value.
 * Native environment-name identity also applies to differently cased names.
 *
 * @evidence contracts/common.md#principled-implementation Only the caller's explicit channel value establishes this invocation's semantic owner; absence removes inherited authority rather than anchoring a nested build to an unrelated wrapper.
 * @evidence contracts/common.md#clear-and-simple-design This helper owns semantic-config inheritance policy and delegates native name identity to the shared environment boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Channel cleanup changes only the supplied child environment and does not alter the global process environment or invent a config path.
 * @evidence contracts/common.md#meaningful-documentation The native comment explains retained caller authority and alias handling, following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The shared reader and writer preserve POSIX case distinctions and clear every Windows alias of the invocation channel.
 * @evidence contracts/performance.md#efficient-algorithms The shared boundary performs at most one scan of each supplied environment on Windows; POSIX channel lookup and deletion are direct key operations.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Environment mutation is this invocation's ownership effect and cannot be replaced by a prior cleanup result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Both environment objects remain caller-owned; no historical wrapper authority or native handle is retained here.
 */
export function clearInheritedSemanticConfigPath(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  SidecarEnvironment.write(
    env,
    SEMANTIC_CONFIG_PATH_ENV,
    SidecarEnvironment.read(callerEnv, SEMANTIC_CONFIG_PATH_ENV),
  );
}
