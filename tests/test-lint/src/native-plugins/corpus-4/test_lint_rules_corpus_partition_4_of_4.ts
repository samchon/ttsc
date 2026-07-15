import { assertAllLintCases } from "../../helpers/assertLintCase";

/**
 * Verifies lint corpus partition 4/4 against its classified fixtures.
 *
 * The large fixture corpus is the single heaviest lint scenario, so it is split
 * into four evenly-costed partitions that run on parallel CI lanes. This one
 * asserts every 4th fixture (`index % 4 === 3`); the four partitions together
 * cover the whole corpus exactly once.
 *
 * 1. Classify every TypeScript fixture under `src/cases`.
 * 2. Keep this partition's `index % 4 === 3` slice.
 * 3. Assert every entry's native output or audited skip contract.
 */
export const test_lint_rules_corpus_partition_4_of_4 = (): void => {
  assertAllLintCases({ index: 3, total: 4 });
};
