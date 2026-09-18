import fs from "node:fs";

import type { TtscTransformFilesystemOperations } from "./TtscTransformFilesystemOperations";

/**
 * The host filesystem, expressed as the operations every generation proof uses.
 *
 * Synchronous on purpose: a proof compares a before and an after observation,
 * and nothing may interleave between them on the same turn. Metadata reads use
 * `bigint` stats for nanosecond precision, and `realpath` uses the native form
 * so Windows short names expand to what native watchers report.
 */
export const DEFAULT_FILESYSTEM_OPERATIONS: TtscTransformFilesystemOperations =
  Object.freeze({
    exists: fs.existsSync,
    lstat: (location: string) => fs.lstatSync(location, { bigint: true }),
    readFile: (location: string) => fs.readFileSync(location),
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
    realpath: fs.realpathSync.native,
    stat: fs.statSync,
    statBigInt: (location: string) => fs.statSync(location, { bigint: true }),
  });
