import type { ITtscCompilerTransformation } from "ttsc";

/**
 * One whole-project compile a worker published to its session's store
 * (samchon/ttsc#1390).
 *
 * The envelope names paths inside the publisher's own scratch directory, such
 * as its generated tsconfig. An adopter keeps those paths so it excludes them
 * from its inputs exactly as the publisher would, although they no longer
 * exist.
 */
export interface TtscSharedCompilePublication {
  /**
   * Content hash of each external input the publisher recorded right after its
   * compile, keyed by absolute path. A plugin-reported dependency outside the
   * project carries no compile-time proof in the envelope, so an adopter must
   * find exactly these states.
   */
  externalInputHashes: Record<string, string>;

  /** Physical path of each external input, paired with the hashes. */
  externalInputRealpaths: Record<string, string | null>;

  /**
   * The compile's envelope, always a `success`: a failed envelope may come from
   * a transient crash, which every worker must be free to attempt again.
   */
  result: ITtscCompilerTransformation;

  /** The publisher's compiler scratch directory. */
  scratchDirectory: string;

  /** The publisher's generated tsconfig, when the compile used one. */
  temporaryTsconfig?: string;
}
