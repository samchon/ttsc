import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { NativePluginArguments } from "../build/NativePluginArguments";

/**
 * Publish this invocation's linked transform plugins to a sidecar
 * environment, or drop a manifest inherited from an outer ttsc run.
 *
 * `TTSC_LINKED_PLUGINS_JSON` names the plugins linked into the host binary this
 * invocation selected. Every sidecar env starts from `process.env`, so a ttsc
 * running inside another host's sidecar would otherwise hand the outer run's
 * manifest to a nested build that linked nothing, and the Go host would run
 * plugins it never chose, or fail on a payload it cannot parse. The manifest is
 * per-invocation state the spawning host owns, the rule the forwarded tsgo
 * payload already follows. A caller that named the variable explicitly keeps
 * it.
 */
export function publishLinkedTransformPlugins(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
  linked: readonly ITtscLoadedNativePlugin[],
): void {
  if (linked.length !== 0) {
    env[LINKED_PLUGINS_ENV] = NativePluginArguments.serializeNativePlugins(linked);
  } else if (callerEnv?.[LINKED_PLUGINS_ENV] === undefined) {
    delete env[LINKED_PLUGINS_ENV];
  }
}

const LINKED_PLUGINS_ENV = "TTSC_LINKED_PLUGINS_JSON";
