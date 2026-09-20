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
