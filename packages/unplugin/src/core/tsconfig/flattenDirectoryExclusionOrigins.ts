import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";

/** Flatten provenance into the directory list consumed by the project walk. */
export function flattenDirectoryExclusionOrigins(
  origins: NonNullable<
    ITtscProjectMembershipPolicy["directoryExclusionOrigins"]
  >,
): string[] {
  return [
    ...(origins.useImplicitOutputExclusions === false
      ? []
      : OUTPUT_DIRECTORY_OPTIONS.flatMap((key) => {
          const directory = origins[key];
          return directory === undefined ? [] : [directory];
        })),
    ...origins.exclude,
  ];
}
