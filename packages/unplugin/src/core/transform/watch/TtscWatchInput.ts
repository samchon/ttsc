import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/** One derived input and its optional generation proof. */
export interface TtscWatchInput {
  /**
   * What the generation recorded for this input; absent on failed-generation
   * recovery registrations.
   */
  evidence?: TtscWatchInputEvidence;
  /** Absolute lexical spelling of the input. */
  file: string;
}
