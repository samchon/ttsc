import type { ITtscCompilerTransformation } from "ttsc";

import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Proof witnesses retained beside a compiler result without extending its API. */
export const TRANSFORM_GENERATION_FAILURES = new WeakMap<
  ITtscCompilerTransformation,
  TtscGenerationProofFailures
>();
