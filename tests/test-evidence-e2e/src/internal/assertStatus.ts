import type { IRunResult } from "../../../utils/src/evidence/IRunResult";

/** Fails when the real compiler exits with an unexpected status. */
export const assertStatus = (
  result: IRunResult,
  expected: number,
  because: string,
): void => {
  if (result.status === expected) return;
  throw new Error(
    `${because}\n\nExpected exit status: ${expected}\nActual exit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};
