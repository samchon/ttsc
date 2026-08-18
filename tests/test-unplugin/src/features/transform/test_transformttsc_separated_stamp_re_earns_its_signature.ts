import { assertSeparatedStampReEarnsItsSignature } from "../../internal/transform-project-cache";

/**
 * Verifies an input re-earns its metadata signature once its stamp's tick is
 * provably over, and keeps the content comparison until then.
 *
 * Locks samchon/ttsc#1227's re-earn acceptance in `matchesProvenInput` and the
 * clock floor behind `stampSeparable`: declining a signature must cost reads,
 * never the generation, and an input seen mid-tick must not be condemned to a
 * content read for the generation's life — the moment the observed filesystem
 * mints a strictly newer stamp, the next successful content comparison records
 * the signature again.
 *
 * 1. Deliver a project whose every stamp sits in one pinned tick and assert a
 *    steady delivery keeps re-reading inputs while keeping the cache.
 * 2. Move one input's reported stamp to the next tick, then deliver every module
 *    once so the raised clock floor lets every other input prove itself.
 * 3. Assert a later delivery reads only the input at the clock floor, with the
 *    generation never replaced.
 */
export const test_transformttsc_separated_stamp_re_earns_its_signature =
  async () => {
    await assertSeparatedStampReEarnsItsSignature();
  };
