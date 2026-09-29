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
 *
 * @evidence contracts/common.md#principled-implementation The inherited declaration is usable only as an absolute existing directory; absent or inaccessible storage leaves local compilation available.
 * @evidence contracts/common.md#clear-and-simple-design The reader validates one environment value without opening stores, creating directories, or changing the caller's environment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure withdraws only optional sharing and never fabricates a publication or compiler success.
 * @evidence contracts/common.md#meaningful-documentation The comment identifies the inherited capability and precise absence behavior, including the reason failure is nonfatal.
 * @evidence contracts/portability.md#os-neutral-implementation Node native isAbsolute and stat interpret the inherited store address, preserving drive and root forms; an unavailable directory withdraws optional sharing rather than assuming a fixed OS storage layout.
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
