import type { ITtscProjectInputSnapshot } from "./ITtscProjectInputSnapshot";
import type { TtscCommonOptions } from "./TtscCommonOptions";

/**
 * Internal options for emitting one source file through the file-argument path.
 *
 * @evidence contracts/common.md#principled-implementation The required source file selects a single-file operation; optional config/output controls preserve discovery and destination defaults, while callbacks publish distinct source and project-rule watch inputs.
 * @evidence contracts/common.md#clear-and-simple-design Shared process policy is inherited, and two explicit notifications keep plugin-source roots separate from richer project-rule topology.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Watch notifications are caller hooks receiving actual discovered inputs, not foreign watcher replacements or synthetic paths for tests.
 * @evidence contracts/common.md#meaningful-documentation Native comments identify path bases, config discovery, quiet behavior and callback payloads; member and tag separation follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native file/config/output paths retain their documented resolution bases, and watch inputs are structured path populations; no command string or POSIX-only parsing is encoded in the input shape.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export interface TtscSingleFileEmitOptions extends TtscCommonOptions {
  /** Source file to emit. Absolute paths and `cwd`-relative paths work. */
  file: string;

  /** Project config owning `file`; discovered from `file` when omitted. */
  tsconfig?: string;

  /** Optional output file path. */
  out?: string;

  /** Suppress summary banners from ttsc/native sidecars. Defaults to `true`. */
  quiet?: boolean;

  /** Receive native-plugin source roots when a watch owns this invocation. */
  onWatchInputs?: TtscPluginSourceInputsHandler;

  /** Receive project-rule filesystem inputs when a watch owns this invocation. */
  onProjectInputs?: TtscProjectInputsHandler;
}

/**
 * Receive native-plugin source roots for the invocation's watch owner.
 *
 * @evidence contracts/common.md#principled-implementation Readonly roots describe the actual native-plugin sources whose later edits need observation.
 * @evidence contracts/common.md#clear-and-simple-design A void notification leaves watcher construction and lifetime with the invocation owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported callback neither replaces foreign watchers nor fabricates fixture-specific roots.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the source population and owner before acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation Native source paths pass through without separator rewriting, alias collapse or an encoded OS-specific watcher.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type TtscPluginSourceInputsHandler = (inputs: readonly string[]) => void;

/**
 * Receive the discovered project-rule filesystem topology for the watch owner.
 *
 * @evidence contracts/common.md#principled-implementation The snapshot retains exact, glob and reload dependencies rather than reducing them to plugin-source roots.
 * @evidence contracts/common.md#clear-and-simple-design A separate void notification transfers topology without assigning watcher lifetime to the emit options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A discovered rule snapshot crosses a supported boundary without replacing watcher internals or inventing passing inputs.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the project-rule payload and watch owner before the separated tags.
 * @evidence contracts/portability.md#os-neutral-implementation The snapshot retains native paths, explicit glob grammar and declared versus physical identities without blanket case folding.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type TtscProjectInputsHandler = (
  inputs: ITtscProjectInputSnapshot,
) => void;
