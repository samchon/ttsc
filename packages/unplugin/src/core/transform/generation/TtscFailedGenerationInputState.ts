/**
 * What a failed generation recorded about one input outside the project walk
 * (samchon/ttsc#1398).
 */
export interface TtscFailedGenerationInputState {
  /**
   * The input's metadata signature before its state was read, kept only when
   * its clock proves a later write moves it. While the signature still matches,
   * the input carries the recorded state and is not read again.
   */
  signature?: string;
  /**
   * The input's full state: metadata, content, realpath, and listing; or, for a
   * plugin source directory, its digest (`pluginSourceState`).
   */
  state: string;
  /**
   * Whether the input is a plugin source directory (samchon/ttsc#1487), whose
   * state is its digest, since no one path's metadata stands for the files
   * below it; it carries no signature.
   */
  tree?: true;
}
