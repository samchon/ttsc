import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ResidentCheckEntryPlan } from "./ResidentCheckEntryPlan";

/**
 * Plan every configured check entry while sharing resident processes only by
 * binary/name/argument identity.
 *
 * Forwarded compiler flags are part of that identity even though they travel
 * through the environment. Configuration positions remain distinct so shared
 * processes do not collapse check executions or change delivery order.
 *
 * @evidence contracts/common.md#principled-implementation Capability-gated resident keys include binary, plugin name, argv and forwarded compiler payload, while each check retains its own configuration index.
 * @evidence contracts/common.md#clear-and-simple-design Filtering selects check-stage entries and mapping records their execution plan; process-key construction is isolated from per-entry scheduling.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Resident support comes from declared capabilities rather than binary-name guesses; duplicate entries are not silently skipped.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes process sharing, environment-carried compiler arguments and separate configured executions.
 * @evidence contracts/portability.md#os-neutral-implementation Binary and argv remain separate native process inputs; JSON encodes argument boundaries without shell quoting or path case assumptions.
 * @evidence contracts/performance.md#efficient-algorithms Filtering scans all plugins, then mapping visits selected checks and calls the argument composer once per entry. Cost includes those composer calls and resident-key string/JSON bytes; the current composer serializes the full plugin manifest separately for every configured check. Returned storage scales with selected entries and their argument/key bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Equivalent resident startup selections receive the same key; the session additionally requires stable execution context and resets topology before reuse.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Plans describe process selection but acquire no sidecars or retained requests themselves.
 */
export function planResidentCheckEntries(
  plugins: readonly ITtscLoadedNativePlugin[],
  createArgs: (plugin: ITtscLoadedNativePlugin) => string[],
  // Part of the process identity even though it never appears in argv: the
  // forwarded tsgo payload rides the environment, and a resident process holds
  // the compiler options it was started with. Two cycles that forward different
  // flags must not share one warm Program.
  tsgoArgs?: string,
): ResidentCheckEntryPlan[] {
  return plugins
    .filter((candidate) => candidate.stage === "check")
    .map((plugin, entryIndex) => {
      const args = createArgs(plugin);
      return {
        args,
        entryIndex,
        key:
          plugin.capabilities?.residentCheck === true
            ? residentCheckProcessKey(plugin, args, tsgoArgs)
            : undefined,
        plugin,
      };
    });
}

function residentCheckProcessKey(
  plugin: ITtscLoadedNativePlugin,
  args: readonly string[],
  tsgoArgs?: string,
): string {
  return `${plugin.binary}\0${plugin.name}\0${JSON.stringify(args)}\0${tsgoArgs ?? ""}`;
}
