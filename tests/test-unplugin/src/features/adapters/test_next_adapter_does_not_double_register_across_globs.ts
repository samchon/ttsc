import { assertNextAdapterDoesNotDoubleRegisterAcrossGlobs } from "../../internal/adapter-next";

/**
 * Verifies the wrapper does not register its loader twice for one file set.
 *
 * See {@link assertNextAdapterDoesNotDoubleRegisterAcrossGlobs}: a caller who
 * hand-wired `"*.{ts,tsx}"` kept it and received the wrapper's two globs as
 * well, so every module matched two rules and the loader ran twice
 * (samchon/ttsc#1314).
 */
export const test_next_adapter_does_not_double_register_across_globs =
  async () => {
    await assertNextAdapterDoesNotDoubleRegisterAcrossGlobs();
  };
