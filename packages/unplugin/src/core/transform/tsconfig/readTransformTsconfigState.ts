import { readEffectiveTsconfigPaths } from "../../tsconfig/readEffectiveTsconfigPaths";
import { readEffectiveTsconfigTemplateCompilerOptions } from "../../tsconfig/readEffectiveTsconfigTemplateCompilerOptions";
import { readEffectiveTsconfigTemplateFileSpecs } from "../../tsconfig/readEffectiveTsconfigTemplateFileSpecs";
import { readProjectMembershipPolicy } from "../../tsconfig/readProjectMembershipPolicy";
import { readTsconfigSourceSnapshot } from "../../tsconfig/readTsconfigSourceSnapshot";
import { hashText } from "../utils/hashText";
import type { ITransformTsconfigState } from "./ITransformTsconfigState";

/**
 * Read every wrapper-dependent view and bind it to one config-chain state.
 *
 * @param compilerConfigDir The project's config directory as the compiler
 *   spells it, which the wrapper's re-stated `${configDir}` values are anchored
 *   at (samchon/ttsc#1456); the config's own directory as named when absent.
 *
 * @evidence contracts/common.md#principled-implementation Membership policy is always read, while materialized wrappers additionally bind effective paths and template views to a source-chain digest for capture's subsequent before/after comparison.
 * @evidence contracts/common.md#clear-and-simple-design Existing readers own configuration interpretation; this operation assembles the required views and skips wrapper-only work when no wrapper is needed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature includes source bytes as well as derived views, rather than letting a quiet watcher or one unchanged option stand in for the entire configuration chain.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies wrapper-dependent state, and the parameter paragraph explains why inherited template resolution uses compiler spelling.
 * @evidence contracts/portability.md#os-neutral-implementation Existing config readers own native resolution and actual filesystem observations; this assembler passes compilerConfigDir to inherited templates instead of assuming adapter lexical spelling equals physical compiler spelling.
 */
export function readTransformTsconfigState(
  tsconfig: string,
  materializesConfig: boolean,
  compilerConfigDir?: string,
): ITransformTsconfigState {
  const membershipPolicy = readProjectMembershipPolicy(tsconfig);
  if (!materializesConfig) {
    return {
      effectivePaths: {},
      membershipPolicy,
      templateCompilerOptions: {},
      templateFileSpecs: {},
    };
  }
  const effectivePaths = readEffectiveTsconfigPaths(tsconfig);
  const templateCompilerOptions = readEffectiveTsconfigTemplateCompilerOptions(
    tsconfig,
    compilerConfigDir,
  );
  const templateFileSpecs = readEffectiveTsconfigTemplateFileSpecs(
    tsconfig,
    compilerConfigDir,
  );
  const sources = readTsconfigSourceSnapshot(tsconfig);
  return {
    effectivePaths,
    membershipPolicy,
    signature: hashText(
      JSON.stringify({
        effectivePaths,
        membershipPolicy,
        sources,
        templateCompilerOptions,
        templateFileSpecs,
      }),
    ),
    templateCompilerOptions,
    templateFileSpecs,
  };
}
