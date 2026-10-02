import { readEffectiveTsconfigPaths } from "../../tsconfig/readEffectiveTsconfigPaths";
import { readEffectiveTsconfigTemplateCompilerOptions } from "../../tsconfig/readEffectiveTsconfigTemplateCompilerOptions";
import { readEffectiveTsconfigTemplateFileSpecs } from "../../tsconfig/readEffectiveTsconfigTemplateFileSpecs";
import { readProjectMembershipPolicy } from "../../tsconfig/readProjectMembershipPolicy";
import { readTsconfigSourceSnapshot } from "../../tsconfig/readTsconfigSourceSnapshot";
import { hashText } from "../utils/hashText";
import type { ITransformTsconfigState } from "./ITransformTsconfigState";

/**
 * Assemble membership and wrapper-dependent views with a config-chain digest.
 * Readers make separate native observations; the digest is a composite for
 * capture's before/after comparison, not one atomic config-chain snapshot.
 *
 * @param compilerConfigDir The project's config directory as the compiler
 *   spells it, which the wrapper's re-stated `${configDir}` values are anchored
 *   at (samchon/ttsc#1456); the config's own directory as named when absent.
 *
 * @evidence contracts/common.md#principled-implementation Membership policy is always read; materialized wrappers additionally combine effective paths/templates and separately observed source bytes into capture's before/after digest. Digest equality compares those observations without proving the filesystem never changed between reads.
 * @evidence contracts/common.md#clear-and-simple-design Existing readers own configuration interpretation; this operation assembles the required views and skips wrapper-only work when no wrapper is needed.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature includes source bytes as well as derived views, rather than letting a quiet watcher or one unchanged option stand in for the entire configuration chain.
 * @evidence contracts/common.md#meaningful-documentation The native comment identifies wrapper-dependent state, and the parameter paragraph explains why inherited template resolution uses compiler spelling.
 * @evidence contracts/portability.md#os-neutral-implementation Existing readers own native resolution and filesystem observations; the optional compilerConfigDir is a supplied best-effort template anchor, not certified physical identity or proof adapter and compiler spellings coincide.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Membership is one reader pass. Materialization additionally invokes paths,
 *   compiler-template, file-template and raw-source readers with separate parse
 *   transactions, then serializes and hashes B composite bytes. Config depth,
 *   package/native lookup, source bytes and derived option/spec counts drive
 *   cost; no-loop assembly does not erase those repeated delegated passes.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One returned bundle serves membership, wrapper construction and capture's
 *   digest comparison. Reader-local transactions share their option queries,
 *   without claiming a shared parse transaction across these views. A later
 *   before/after question creates a fresh bundle rather than retaining old bytes.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
