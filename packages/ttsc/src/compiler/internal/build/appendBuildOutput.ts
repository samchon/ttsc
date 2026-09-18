import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { normalizeBuildOutput } from "./normalizeBuildOutput";

/**
 * Merge two `TtscBuildResult` values into one.
 *
 * - `status`: the right status wins unless it is 0 (failure propagates).
 * - `diagnostics`: concatenated left then right.
 * - `emittedFiles`: right wins when present, otherwise left is kept.
 * - `stdout`/`stderr`: concatenated left then right.
 */
export function appendBuildOutput(
  left: TtscBuildResult,
  right: TtscBuildResult,
): TtscBuildResult {
  return normalizeBuildOutput({
    diagnostics: [...left.diagnostics, ...right.diagnostics],
    emittedFiles:
      right.emittedFiles !== undefined ? right.emittedFiles : left.emittedFiles,
    status: right.status !== 0 ? right.status : left.status,
    stdout: left.stdout + right.stdout,
    stderr: left.stderr + right.stderr,
  });
}
