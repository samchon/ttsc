import type { IRunResult } from "../../../../../utils/src/evidence/IRunResult";

/** Fails with a message that shows what the toolchain actually printed. */
export const assertIncludes = (
  result: IRunResult,
  expected: string,
  because: string,
): void => {
  if (result.output.includes(expected)) return;
  throw new Error(
    `${because}\n\nExpected output to include:\n  ${expected}\n\nActual output:\n${result.output}`,
  );
};
