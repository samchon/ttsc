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
  /** The input's full state: metadata, content, realpath, and listing. */
  state: string;
}
