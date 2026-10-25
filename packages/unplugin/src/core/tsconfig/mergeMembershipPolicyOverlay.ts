import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { JAVASCRIPT_INPUT_EXTENSIONS } from "./JAVASCRIPT_INPUT_EXTENSIONS";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";
import { flattenDirectoryExclusionOrigins } from "./flattenDirectoryExclusionOrigins";
import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";
import { resolveMembershipInputExtensions } from "./resolveMembershipInputExtensions";

/**
 * Apply the caller's compiler-options overlay on top of a policy read from the
 * project config.
 *
 * The overlay wins for the compile, so it wins here too. A caller that turns
 * `allowJs` on gets a program that admits JavaScript, and a membership rule
 * that still refused it would miss files entering that program; a caller that
 * turns it off gets the narrower rule for the same reason.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Extension option provenance preserves explicit false and null clearing
 *   while recomputing implicit JavaScript and JSON defaults. Mapper suffixes
 *   remain independent. Output paths update their own exclusion provenance;
 *   missing legacy provenance preserves authored extension/exclusion lists.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   The operation clones extension and exclusion state rather than mutating
 *   the source policy; one provenance flattener owns default exclusion rules.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Output-directory overlays resolve at the supplied native config anchor
 *   through compiler separator/template rules; existing root identity and
 *   compiler case representation transfer without OS-name reinterpretation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Overlay values come from the actual compile options, not emitted filename
 *   guesses or directories selected for known test projects.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native explanation gives the reason compile and walk overlays must
 *   agree; exclusion defaults remain documented on the owning policy members.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Copies E extension entries into a Set and N explicit exclusion references
 *   into new provenance and flattened output arrays. Fixed flag/output-option
 *   scans add bounded entry counts, while supplied output path resolution still
 *   follows path text. Shared root specs, sources and case data are not recopied.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Applies one supplied overlay. Selection and generation owners decide when
 *   a policy is reusable; this operation coordinates no cross-call computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Transfers the merged policy and new arrays to its caller; the local Set
 *   ends on return. It owns no historical cache or native handle.
 */
export function mergeMembershipPolicyOverlay(
  policy: ITtscProjectMembershipPolicy,
  compilerOptions: Record<string, unknown>,
  baseDir: string,
): ITtscProjectMembershipPolicy {
  const inputExtensions = new Set(policy.inputExtensions);
  const applyFlag = (key: string, extensions: readonly string[]): void => {
    const value = compilerOptions[key];
    if (typeof value !== "boolean") {
      return;
    }
    for (const extension of extensions) {
      if (value) {
        inputExtensions.add(extension);
      } else {
        inputExtensions.delete(extension);
      }
    }
  };
  const extensionOptionOrigins =
    policy.extensionOptionOrigins === undefined
      ? undefined
      : { ...policy.extensionOptionOrigins };
  if (extensionOptionOrigins === undefined) {
    applyFlag("allowJs", JAVASCRIPT_INPUT_EXTENSIONS);
    applyFlag("resolveJsonModule", [".json"]);
  } else {
    for (const key of ["allowJs", "checkJs", "resolveJsonModule"] as const) {
      if (!Object.hasOwn(compilerOptions, key)) continue;
      const value = compilerOptions[key];
      if (value === null) delete extensionOptionOrigins[key];
      else if (typeof value === "boolean") extensionOptionOrigins[key] = value;
    }
    for (const key of ["module", "moduleResolution"] as const) {
      if (!Object.hasOwn(compilerOptions, key)) continue;
      const value = compilerOptions[key];
      if (value === null) delete extensionOptionOrigins[key];
      else if (typeof value === "string") extensionOptionOrigins[key] = value;
    }
  }

  const inheritedOrigins = policy.directoryExclusionOrigins;
  const directoryExclusionOrigins: {
    declarationDir?: string;
    exclude: string[];
    outDir?: string;
    useImplicitOutputExclusions: boolean;
  } = {
    declarationDir: inheritedOrigins?.declarationDir,
    exclude: [...(inheritedOrigins?.exclude ?? policy.excludedDirectories)],
    outDir: inheritedOrigins?.outDir,
    useImplicitOutputExclusions:
      inheritedOrigins?.useImplicitOutputExclusions ?? true,
  };
  for (const key of OUTPUT_DIRECTORY_OPTIONS) {
    const value = compilerOptions[key];
    if (value === null) {
      delete directoryExclusionOrigins[key];
    } else if (typeof value === "string") {
      directoryExclusionOrigins[key] = resolveConfigDirTemplatePath(
        baseDir,
        value,
      );
    }
  }
  return {
    rootFileSpecs: policy.rootFileSpecs,
    directoryExclusionOrigins,
    excludedDirectories: flattenDirectoryExclusionOrigins(
      directoryExclusionOrigins,
    ),
    extensionOptionOrigins,
    inputExtensions:
      extensionOptionOrigins === undefined
        ? [...inputExtensions]
        : resolveMembershipInputExtensions(extensionOptionOrigins),
    sources: policy.sources,
    useCaseSensitiveFileNames: policy.useCaseSensitiveFileNames,
  };
}
