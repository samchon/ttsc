import type { IRunResult } from "../../../utils/src/evidence/IRunResult";

/**
 * Fails when the toolchain printed something a case requires to be absent.
 *
 * The negative twin of {@link assertIncludes}. Asserting an absence is what
 * distinguishes a rule that stayed correctly quiet from one that never ran, so
 * the failure message shows the whole output rather than only the forbidden
 * text.
 */
export const assertExcludes = (
  result: IRunResult,
  forbidden: string,
  because: string,
): void => {
  if (!result.output.includes(forbidden)) return;
  throw new Error(
    `${because}\n\nExpected output NOT to include:\n  ${forbidden}\n\nActual output:\n${result.output}`,
  );
};
