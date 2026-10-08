import { SidecarEnvironment } from "./SidecarEnvironment";
import { TSGO_ARGS_CWD_ENV } from "./TSGO_ARGS_CWD_ENV";
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
 * explicitly keeps it. Its argument-cwd companion follows the same explicit
 * ownership, and publication of a new payload owns both channels.
 *
 * @evidence contracts/common.md#principled-implementation A nested sidecar keeps forwarded argv only when its caller declares that channel; otherwise outer invocation flags cannot silently change its compiler options.
 * @evidence contracts/common.md#clear-and-simple-design One helper owns tsgo-payload inheritance policy and shares native environment-name handling with the other invocation channels.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Cleanup removes unrelated inherited authority rather than rewriting compiler behavior or substituting an expected diagnostic.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain nested-sidecar contamination and explicit preservation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native name lookup and replacement use the shared boundary, including Windows aliases and POSIX exact-name identity.
 * @evidence contracts/performance.md#efficient-algorithms Cleanup delegates at most two caller-name scans and two child-name scans on Windows, including their Object.keys arrays and uppercase/comparison/deletion text costs. POSIX uses direct supplied-object key operations; neither branch parses or constructs a copy of forwarded payload text.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The mutable child channel belongs to the current spawn and has no reusable cross-invocation cleanup result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This mutation retains no payload history, table, descriptor or running task.
 */
export function clearInheritedTsgoArgs(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  SidecarEnvironment.write(
    env,
    TSGO_ARGS_ENV,
    SidecarEnvironment.read(callerEnv, TSGO_ARGS_ENV),
  );
  SidecarEnvironment.write(
    env,
    TSGO_ARGS_CWD_ENV,
    SidecarEnvironment.read(callerEnv, TSGO_ARGS_CWD_ENV),
  );
}
