import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import type { TtscFailedGenerationInputState } from "./TtscFailedGenerationInputState";

/** Filesystem state that may authorize replacing one terminal failed generation. */
export interface TtscFailedGenerationValidation {
  /** Last attempted generation, retained only as a comparison baseline. */
  cached: TtscCachedProjectTransform;
  /** Input keys whose content can affect the generation, or the whole walk. */
  declaredInputs: ReadonlySet<string> | undefined;
  /** Fingerprints of every out-of-walk and exact host input. */
  inputStates: ReadonlyMap<string, TtscFailedGenerationInputState>;
  /** On-disk project hashes the final attempt's walk recorded. */
  projectInputHashes: Readonly<Record<string, string>>;
  /** Coherence and exact failure state of the final project walk. */
  projectWalkComplete: boolean;
  /**
   * Fingerprint of the walk failures relevant to the declared inputs, so a
   * change in them permits a retry.
   */
  projectWalkFailures: string;
}
