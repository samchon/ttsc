import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { JAVASCRIPT_INPUT_EXTENSIONS } from "./JAVASCRIPT_INPUT_EXTENSIONS";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";
import { flattenDirectoryExclusionOrigins } from "./flattenDirectoryExclusionOrigins";
import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";

/**
 * Apply the caller's compiler-options overlay on top of a policy read from the
 * project config.
 *
 * The overlay wins for the compile, so it wins here too. A caller that turns
 * `allowJs` on gets a program that admits JavaScript, and a membership rule
 * that still refused it would miss files entering that program; a caller that
 * turns it off gets the narrower rule for the same reason.
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
  applyFlag("allowJs", JAVASCRIPT_INPUT_EXTENSIONS);
  applyFlag("resolveJsonModule", [".json"]);

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
    inputExtensions: [...inputExtensions],
    sources: policy.sources,
  };
}
