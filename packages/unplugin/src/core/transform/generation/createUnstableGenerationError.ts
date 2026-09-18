import path from "node:path";

import { disposeCachedTransform } from "../cache/disposeCachedTransform";
import { TtscUnstableGenerationError } from "../errors/TtscUnstableGenerationError";
import type { TtscFailedGenerationValidation } from "./TtscFailedGenerationValidation";
import type { TtscGenerationProofFailures } from "./TtscGenerationProofFailures";

/** Render one input without leaking source content or control characters. */
function formatGenerationFailurePath(
  projectRoot: string,
  input: string,
): string {
  const absolute = path.resolve(input);
  const relative = path.relative(projectRoot, absolute);
  const display =
    relative === ""
      ? "."
      : relative !== ".." &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)
        ? relative
        : absolute;
  return JSON.stringify(display.split(path.sep).join("/"));
}

/** Build the terminal error shared by every waiter of an unstable generation. */
export function createUnstableGenerationError(
  projectRoot: string,
  attempts: readonly TtscGenerationProofFailures[],
  validation: TtscFailedGenerationValidation,
): TtscUnstableGenerationError {
  const lines = [
    `ttsc: could not capture a reusable transform generation after ${attempts.length} attempts.`,
    `  project: ${projectRoot}`,
  ];
  attempts.forEach((failures, index) => {
    lines.push(`  attempt ${index + 1}:`);
    if (failures.entries.length === 0) {
      lines.push("    - project/generation-proof-incomplete");
    }
    for (const failure of failures.entries) {
      const input =
        failure.path === undefined
          ? ""
          : `: ${formatGenerationFailurePath(projectRoot, failure.path)}`;
      const detail =
        failure.detail === undefined
          ? ""
          : ` (producer: ${JSON.stringify(failure.detail)})`;
      lines.push(`    - ${failure.domain}/${failure.kind}${input}${detail}`);
    }
    if (failures.omitted !== 0) {
      lines.push(
        `    - ... ${failures.omitted} additional witness(es) omitted`,
      );
    }
  });
  lines.push(
    "  Stop writes to the listed inputs before compilation, or fix the producer that omitted or contradicted the listed proof.",
  );
  // The failed snapshot remains useful as immutable retry evidence, but it can
  // never serve a module. Release every live resource before its terminal
  // verdict is retained in the cache.
  disposeCachedTransform(validation.cached);
  return new TtscUnstableGenerationError(lines.join("\n"), validation);
}
