import { assertUnreadableGraphInputKeepsTheContentComparison } from "../../internal/transform-project-cache";

/**
 * Verifies a graph member with no readable content never acquires a proof.
 *
 * A metadata signature stands for the bytes a read proved, so an input that has
 * none cannot have one. A member the compiler recorded without a content hash,
 * and that the host can stat but not read, matches its recorded `missing` state
 * exactly while it stays unreadable. Handing it a signature at capture would
 * mean that becoming readable without a metadata change leaves the narrow path
 * skipping it for the generation's life.
 *
 * 1. Stamp one graph member with no compiler-time hash and refuse its reads
 *    through the cache-owned filesystem seam.
 * 2. Deliver every module and assert the cache still hits once.
 * 3. Allow adapter reads again without changing the compiler's missing proof, and
 *    assert the contradiction terminates after one bounded retry wave.
 */
export const test_transformttsc_unreadable_graph_input_keeps_the_content_comparison =
  async () => {
    await assertUnreadableGraphInputKeepsTheContentComparison();
  };
