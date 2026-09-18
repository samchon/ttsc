import type { TtscWatchInputEvidence } from "./TtscWatchInputEvidence";

/** One derived input and its optional generation proof. */
export interface TtscWatchInput {
  evidence?: TtscWatchInputEvidence;
  file: string;
}
