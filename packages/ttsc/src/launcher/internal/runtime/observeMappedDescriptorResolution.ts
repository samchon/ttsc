import { RESOLUTION_INPUT_RECORDER_PATH } from "../../../plugin/internal/load/RESOLUTION_INPUT_RECORDER_PATH";

/**
 * Observe mapped descriptor candidates across one actual resolution window.
 *
 * Both the public resolve hook and owned CommonJS resolver use this operation.
 * The shared recorder captures declared targets before Node resolves, narrows
 * those earlier observations to the actual selection and revalidates them at
 * settlement. Missing proof becomes an unstable record, never a later hash.
 * Metadata witnesses transfer with content and physical identity; reporting
 * does not read the filesystem again to recreate a withdrawn observation.
 *
 * @evidence contracts/common.md#principled-implementation Shared pre-resolution content, physical and metadata observations remain authoritative through settlement. Any unavailable or contradictory proof emits unstable=true, preserving the existing runtime reader's monotone refusal.
 * @evidence contracts/common.md#clear-and-simple-design One mapped observation operation serves both runtime callers while their relative and bare policies remain unchanged; the shared recorder owns candidate expansion and selected-root narrowing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Node still selects the actual module. This operation delegates observation to the shared recorder and neither reimplements imports resolution nor replaces foreign methods or cache protocols.
 * @evidence contracts/common.md#meaningful-documentation Native prose states capture, narrowing, metadata transfer and missing-proof behavior, with caller-owned activation and resolution separate from reporting.
 * @evidence contracts/portability.md#os-neutral-implementation Shared native path, file-URL and metadata operations determine selected candidates and physical identities without an OS-specific resolver rule.
 * @evidence contracts/performance.md#efficient-algorithms Pre/post/final observations include candidate and manifest expansion, native metadata and complete file bytes. Result/signature copies and returned records scale with this one window's inputs; no historical recorder population is rescanned.
 * @evidence contracts/performance.md#reuse-equivalent-work Reporting transfers already-captured content, physical and metadata proof without another native observation. Each mutable resolution window receives its own recorder rather than sharing stale witnesses.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One closure retains only this window's recorder until settlement and release; synchronous observations retain no handle. Result records transfer to the caller, with uncapped candidate/path/byte costs and no global history.
 */
export function observeMappedDescriptorResolution(
  specifier: string,
  parent: string,
  extensions: readonly string[],
): {
  commit(selected: string | undefined): {
    resolved: string;
    hash?: string | null;
    realpath?: string | null;
    signature?: string;
    unstable?: boolean;
  }[];
} {
  const recorder = RECORDER.createResolutionInputRecorder({ extensions });
  const token = recorder.beginResolution(specifier, parent);
  return {
    commit(selected) {
      recorder.endResolution(token, selected);
      const result = recorder.finish();
      const signatures = recorder.metadataSignatures();
      return result.inputs.map((resolved) => {
        if (
          !result.complete ||
          !Object.hasOwn(result.hashes, resolved) ||
          !Object.hasOwn(result.realpaths, resolved) ||
          !Object.hasOwn(signatures, resolved)
        )
          return { resolved, unstable: true };
        return {
          resolved,
          hash: result.hashes[resolved],
          realpath: result.realpaths[resolved],
          signature: signatures[resolved],
        };
      });
    },
  };
}

/** The existing shared recorder, loaded once for its implementation. */
const RECORDER = require(RESOLUTION_INPUT_RECORDER_PATH) as {
  createResolutionInputRecorder(options: { extensions: readonly string[] }): {
    beginResolution(specifier: string, parent: string): unknown;
    endResolution(token: unknown, selected: string | undefined): void;
    finish(): {
      complete: boolean;
      inputs: string[];
      hashes: Record<string, string | null>;
      realpaths: Record<string, string | null>;
    };
    metadataSignatures(): Record<string, string>;
  };
};
