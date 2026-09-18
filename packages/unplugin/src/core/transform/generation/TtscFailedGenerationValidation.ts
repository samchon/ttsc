import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";

/** Filesystem state that may authorize replacing one terminal failed generation. */
export interface TtscFailedGenerationValidation {
  /** Last attempted generation, retained only as a comparison baseline. */
  cached: TtscCachedProjectTransform;
  /** Input keys whose content can affect the generation, or the whole walk. */
  declaredInputs: ReadonlySet<string> | undefined;
  /** Fingerprints of every out-of-walk and exact host input. */
  inputStates: ReadonlyMap<string, string>;
  /** Unmodified on-disk project hashes before the in-memory source overlay. */
  projectInputHashes: Readonly<Record<string, string>>;
  /** Coherence and exact failure state of the final project walk. */
  projectWalkComplete: boolean;
  projectWalkFailures: string;
}
