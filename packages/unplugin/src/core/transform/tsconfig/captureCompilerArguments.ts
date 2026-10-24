import { hashText } from "../utils/hashText";
import type { TtscCompilerArgumentsWitness } from "./TtscCompilerArgumentsWitness";
import { compilerEnvironmentIdentity } from "./compilerEnvironmentIdentity";

/**
 * Fingerprint the exact normalized environment chosen for this invocation.
 *
 * @evidence contracts/common.md#principled-implementation The digest uses supplied effective argv/cwd rather than rereading a later parent environment; the supplied override retains its inheritance meaning.
 * @evidence contracts/common.md#clear-and-simple-design One compact witness travels with generations and persisted host records.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No compiler result or filesystem proof is inferred from argument identity.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the normalized-snapshot premise and capture timing.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The environment owner has already normalized native names; tuple spelling is preserved.
 * @evidence contracts/performance.md#efficient-algorithms Tuple encoding scans argument/cwd text and SHA-256 scans the encoded bytes and retain only a fixed digest and optional boolean.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This projection retains no previous result or in-flight operation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned scalar witness transfers to its caller without handles or history.
 */
export function captureCompilerArguments(
  environment: NodeJS.ProcessEnv,
  runExternalCode?: boolean,
): TtscCompilerArgumentsWitness {
  return {
    identity: hashText(compilerEnvironmentIdentity(environment)),
    ...(runExternalCode === undefined ? {} : { runExternalCode }),
  };
}
