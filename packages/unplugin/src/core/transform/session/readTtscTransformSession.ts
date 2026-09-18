import fs from "node:fs";
import path from "node:path";

import { TTSC_TRANSFORM_SESSION_ENV } from "./TTSC_TRANSFORM_SESSION_ENV";

/**
 * The shared compile store of the pooled host session this process belongs to,
 * or `undefined` when there is none (samchon/ttsc#1390).
 *
 * A worker reads {@link TTSC_TRANSFORM_SESSION_ENV}, inherited from the process
 * that configured the pool. The value counts only as an absolute path to an
 * existing directory: sharing is an optimization, so a missing or unusable
 * store simply leaves the worker compiling for itself.
 */
export function readTtscTransformSession(): string | undefined {
  const directory = process.env[TTSC_TRANSFORM_SESSION_ENV];
  if (directory === undefined || !path.isAbsolute(directory)) {
    return undefined;
  }
  try {
    return fs.statSync(directory).isDirectory() ? directory : undefined;
  } catch {
    return undefined;
  }
}
