import { assertMixedCompletenessEnvelopeComposesPerFile } from "../../internal/transform-complete";

/**
 * Verifies transformTtsc derives each file of a mixed envelope by its own
 * completeness status: the declared file narrows, the undeclared one keeps the
 * host-owned union.
 *
 * The negative twin of the narrowing test, and the reason samchon/ttsc#720
 * makes the marker a file list rather than a whole-envelope flag. One transform
 * invocation writes one envelope even when several plugin entries share the
 * host, so a producer that is precise for the files it generates into must
 * still leave every other file on the sound baseline. A derivation that read
 * the declaration envelope-wide would silently narrow files nobody vouched
 * for.
 *
 * 1. Run one transform whose envelope carries output for `src/main.ts` and
 *    `src/other.ts` but declares only `src/main.ts` complete.
 * 2. Collect addWatchFile invocations for each file out of that one cached
 *    envelope.
 * 3. Assert `src/main.ts` narrows to its dependencies plus the tsconfig, while
 *    `src/other.ts` keeps its reach, the globals, and the tsconfig.
 */
export const test_transformttsc_composes_a_mixed_completeness_envelope_per_file =
  async () => {
    await assertMixedCompletenessEnvelopeComposesPerFile();
  };
