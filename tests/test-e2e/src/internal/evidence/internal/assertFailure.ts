import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";

/** Fails unless the compiler rejected the project with a real exit status. */
export const assertFailure = (result: IRunResult, because: string): void => {
  if (result.status !== null && result.status !== 0) return;
  throw new Error(
    `${because}\n\nExpected a non-zero exit status.\nActual exit status: ${String(result.status)}\n\nActual output:\n${result.output}`,
  );
};
