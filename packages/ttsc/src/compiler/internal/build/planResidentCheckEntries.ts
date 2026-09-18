import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import type { ResidentCheckEntryPlan } from "./ResidentCheckEntryPlan";

/**
 * Plan every configured check entry while sharing resident processes only by
 * binary/name/argument identity.
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
