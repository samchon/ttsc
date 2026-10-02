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

/**
 * Build the terminal error shared by waiters of an unstable generation, with
 * bounded per-attempt witnesses and a retained retry comparison baseline.
 * Live generation resources are disposed before the error retains that data.
 * Producer details and native paths are JSON-escaped for safe diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation Each attempted proof contributes its classified witnesses and omitted count, while absent retained entries remain an explicit incomplete proof; the validation baseline identifies the environment that can authorize retry.
 * @evidence contracts/common.md#clear-and-simple-design Error rendering stays here, path attribution uses one private formatter and live generation disposal delegates to the shared lifecycle owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unstable proof is reported rather than converted into reusable output; dropped witnesses remain visible and diagnostic control characters cannot create fictitious lines.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes shared terminal error data from released live resources and explains bounded witnesses and escaped producer input.
 * @evidence contracts/portability.md#os-neutral-implementation Native relative-path classification uses Node path semantics; slash rendering is only diagnostic presentation and does not change filesystem identity or project ownership.
 * @evidence contracts/performance.md#efficient-algorithms Rendering visits each attempt and retained witness once, with native path processing and escaping driven by diagnostic text lengths; delegated disposal also closes the final attempt's retained watchers without rescanning source contents.
 * @evidence contracts/performance.md#reuse-equivalent-work transformProject creates one terminal verdict for its failed attempt sequence, and cache waiters share that error instead of separately rerendering or recompiling the same unchanged environment.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The shared disposer closes watchers and releases clock probes before the terminal error retains comparison data; error lifetime belongs to the generation cache rather than a new resource owner here.
 */
export function createUnstableGenerationError(
  projectRoot: string,
  attempts: readonly TtscGenerationProofFailures[],
  validation: TtscFailedGenerationValidation,
): TtscUnstableGenerationError {
  const lines = [
    `ttsc: could not capture a reusable transform generation after ${attempts.length} attempts.`,
    `  project: ${JSON.stringify(projectRoot)}`,
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
