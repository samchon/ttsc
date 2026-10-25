import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "../source/TYPESCRIPT_TRANSFORM_EXTENSIONS";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { JAVASCRIPT_INPUT_EXTENSIONS } from "./JAVASCRIPT_INPUT_EXTENSIONS";

/**
 * Prime suffix admission from explicit options and pinned TypeScript-Go
 * defaults. Native membership reports still decide whether a primed walk was
 * valid.
 *
 * @evidence contracts/common.md#principled-implementation Pinned 7.0 and 7.1 GetAllowJS, GetResolveJsonModule and GetModuleResolutionKind define these defaults: allowJs overrides checkJs; Node20/NodeNext enable implicit JSON; other modules use effective Bundler resolution unless Node16/18 or an explicit modern node resolution applies.
 * @evidence contracts/common.md#clear-and-simple-design One pure resolver serves config inheritance and compiler-option overlays; declared mapper suffixes are unioned independently of built-in flags.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Constants describe upstream option semantics for supported targets, without consumer names or treating prediction as a native proof.
 * @evidence contracts/common.md#meaningful-documentation Prose states the provisional role and native authority; the origins type documents missing options and mapper ownership.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Only compiler option labels and extension strings are interpreted; no filesystem path or process boundary is crossed.
 * @evidence contracts/performance.md#efficient-algorithms Fixed option branches and one Set union cost O(mapper suffix count and text); output storage follows unique suffixes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resolves one supplied option value without coordinating requests or retaining a memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned array transfers to the caller; no handle or history is retained.
 */
export function resolveMembershipInputExtensions(
  origins: NonNullable<ITtscProjectMembershipPolicy["extensionOptionOrigins"]>,
): string[] {
  const extensions = new Set(TYPESCRIPT_TRANSFORM_EXTENSIONS);
  if (origins.allowJs ?? origins.checkJs)
    for (const extension of JAVASCRIPT_INPUT_EXTENSIONS)
      extensions.add(extension);
  const module = origins.module?.toLowerCase();
  const resolution = origins.moduleResolution?.toLowerCase();
  const modernResolution =
    resolution === "node16" ||
    resolution === "nodenext" ||
    resolution === "bundler";
  const bundler = modernResolution
    ? resolution === "bundler"
    : module !== "node16" &&
      module !== "node18" &&
      module !== "node20" &&
      module !== "nodenext";
  if (
    origins.resolveJsonModule ??
    (module === "node20" || module === "nodenext" || bundler)
  )
    extensions.add(".json");
  for (const extension of origins.mapperExtensions) extensions.add(extension);
  return [...extensions];
}
