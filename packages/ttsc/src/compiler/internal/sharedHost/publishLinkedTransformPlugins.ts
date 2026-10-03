import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { NativePluginArguments } from "../build/NativePluginArguments";
import { SidecarEnvironment } from "./SidecarEnvironment";

/**
 * Publish this invocation's linked transform plugins to a sidecar environment,
 * or drop a manifest inherited from an outer ttsc run.
 *
 * `TTSC_LINKED_PLUGINS_JSON` names the plugins linked into the host binary this
 * invocation selected. Every sidecar env starts from `process.env`, so a ttsc
 * running inside another host's sidecar would otherwise hand the outer run's
 * manifest to a nested build that linked nothing, and the Go host would run
 * plugins it never chose, or fail on a payload it cannot parse. The manifest is
 * per-invocation state the spawning host owns, the rule the forwarded tsgo
 * payload already follows. A caller that named the variable explicitly keeps
 * it.
 *
 * @evidence contracts/common.md#principled-implementation A nonempty selected linked list supplies this invocation's manifest; otherwise only an explicit caller channel may survive, preventing an outer host's libraries from executing in a nested unrelated pass.
 * @evidence contracts/common.md#clear-and-simple-design Publication delegates the wire shape to NativePluginArguments and native name identity to the environment boundary; this helper owns only which invocation may supply the manifest.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Descriptor data selects the linked libraries; inherited unrelated manifests are removed instead of retrying a failed host with guessed plugin configuration.
 * @evidence contracts/common.md#meaningful-documentation The native paragraphs explain current-host ownership, nested-run contamination and explicit caller preservation following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The writer removes Windows aliases before publishing one authoritative channel; POSIX changes only the exact protocol name.
 * @evidence contracts/performance.md#efficient-algorithms A nonempty linked list projects L descriptors and serializes their config/name/stage data, including property traversal and caller conversion rather than only resulting wire bytes. Empty selection observes the caller channel instead. Windows environment scans allocate key arrays and process name text; each selected manifest is serialized once for this destination.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current linked descriptor configuration and destination environment are mutable invocation effects; this publisher owns no shared immutable manifest identity or invalidation coordinator.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Manifest text is stored only on the caller-owned environment; this module retains no linked-plugin population or running host.
 */
export function publishLinkedTransformPlugins(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
  linked: readonly ITtscLoadedNativePlugin[],
): void {
  SidecarEnvironment.write(
    env,
    LINKED_PLUGINS_ENV,
    linked.length !== 0
      ? NativePluginArguments.serializeNativePlugins(linked)
      : SidecarEnvironment.read(callerEnv, LINKED_PLUGINS_ENV),
  );
}

const LINKED_PLUGINS_ENV = "TTSC_LINKED_PLUGINS_JSON";
