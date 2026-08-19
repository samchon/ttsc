import { assertStripNarrowsTheEntryWatchInputs } from "../../internal/transform-linked-completeness";

/**
 * Verifies a program-hook plugin can declare its contribution complete.
 *
 * `@ttsc/strip` declares from `ApplyProgram`, where `@ttsc/banner` declares
 * from `SourcePreamble`; the host counts both hooks as transform contributors,
 * so both must be able to narrow what a consumer validates
 * (samchon/ttsc#1263).
 *
 * 1. Build a project whose entry imports a type-only sibling, wired to
 *    `@ttsc/strip`.
 * 2. Transform the entry and collect the derived watch inputs.
 * 3. Assert the sibling is absent.
 */
export const test_transformttsc_strip_narrows_the_entry_watch_inputs =
  async () => {
    await assertStripNarrowsTheEntryWatchInputs();
  };
