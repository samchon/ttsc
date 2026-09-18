import path from "node:path";

import { pathIsWithin } from "../filesystem/pathIsWithin";

/** Whether an input is owned by the disposable transform scratch tree. */
export function isTransformScratchInput(
  input: string,
  scratchDirectory: string | undefined,
): boolean {
  return (
    scratchDirectory !== undefined &&
    pathIsWithin(path.resolve(input), path.resolve(scratchDirectory))
  );
}
