import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "../source/TYPESCRIPT_TRANSFORM_EXTENSIONS";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { JAVASCRIPT_INPUT_EXTENSIONS } from "./JAVASCRIPT_INPUT_EXTENSIONS";

/**
 * The policy every project falls back to when no configuration is available.
 *
 * Deliberately the widest one: admitting a file that cannot enter the program
 * costs a compile, while refusing one that can costs correctness, and only the
 * second is a defect the user cannot see.
 */
export const PERMISSIVE_PROJECT_MEMBERSHIP_POLICY: ITtscProjectMembershipPolicy =
  {
    directoryExclusionOrigins: {
      exclude: [],
      useImplicitOutputExclusions: true,
    },
    excludedDirectories: [],
    inputExtensions: [
      ...TYPESCRIPT_TRANSFORM_EXTENSIONS,
      ...JAVASCRIPT_INPUT_EXTENSIONS,
      ".json",
    ],
    sources: [],
  };
