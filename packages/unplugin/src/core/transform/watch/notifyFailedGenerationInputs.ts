import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostSpelling } from "../envelope/hostSpelling";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import { projectMembershipInput } from "./projectMembershipInput";

/**
 * Register the failed generation's project and external inputs so the host can
 * observe the fix.
 *
 * A successful delivery registers the derived watch inputs, which is how a
 * type-only file that no bundler graph contains still invalidates the modules
 * depending on it. A failed one used to register nothing: `selectWatchInputs`
 * returns an empty list for an `"exception"` envelope, and the throw happens
 * before `notifyWatchInputs` is reached at all. When the failing compile is the
 * first of a watching session, that leaves no channel through which the fix can
 * arrive: the user repairs a file the bundler does not track, nothing is
 * invalidated, and the error stays on screen (samchon/ttsc#1312).
 *
 * A failure envelope can retain exact external input spellings from its graph
 * and host metadata, including missing resolution candidates on native
 * typecheck failures. For hosts that return no graph, structured diagnostics or
 * standard diagnostic lines provide only the paths they actually name. The cost
 * is paid only on a failure, and only until the next compile succeeds and
 * narrows the set back to the derived inputs.
 */
export function notifyFailedGenerationInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
): void {
  const addWatchFile = hooks?.addWatchFile;
  const addWatchFiles = hooks?.addWatchFiles;
  if (addWatchFile === undefined && addWatchFiles === undefined) {
    return;
  }
  const inputs: TtscWatchInput[] = [];
  const seen = new Set<string>();
  const append = (input: string): void => {
    const spelling = path.resolve(input);
    if (
      seen.has(spelling) ||
      isTransformScratchInput(spelling, cached.scratchDirectory)
    ) {
      return;
    }
    seen.add(spelling);
    // No evidence, deliberately. A failed generation is replayed for the rest
    // of its pass without re-proving its inputs, so the adapter must observe
    // the current availability itself.
    inputs.push({ file: hostSpelling(envelopeDerivation(cached), spelling) });
  };
  for (const key of Object.keys(cached.inputHashes)) {
    append(path.resolve(cached.projectRoot, key));
  }
  // The project walk deliberately excludes node_modules and cannot reach
  // sibling-project or out-of-root inputs. The generation already retained
  // their exact lexical spellings, so keep that ownership on the failure path
  // instead of deriving a narrower second answer.
  for (const input of cached.externalInputPaths ?? []) {
    append(input);
  }
  if (cached.result.type === "failure") {
    for (const diagnostic of cached.result.diagnostics) {
      if (typeof diagnostic.file === "string" && diagnostic.file.length !== 0) {
        append(path.resolve(cached.projectRoot, diagnostic.file));
      }
    }
  } else if (cached.result.type === "exception") {
    for (const diagnostic of selectExceptionDiagnosticFiles(
      cached.result.error,
    )) {
      append(path.resolve(cached.projectRoot, diagnostic));
    }
  }
  // A root file the tsconfig includes, such as the global declaration the
  // failed compile was missing, can repair it too (samchon/ttsc#1419).
  const membership =
    hooks?.membership === true ? projectMembershipInput(cached) : undefined;
  if (membership !== undefined) inputs.push(membership);
  if (addWatchFiles !== undefined) {
    addWatchFiles(inputs, true);
    return;
  }
  for (const input of inputs) {
    addWatchFile!(input.file);
  }
}

/**
 * Extract file spellings only from the two standard TypeScript diagnostic
 * forms.
 */
function selectExceptionDiagnosticFiles(error: unknown): string[] {
  const files: string[] = [];
  for (const line of formatUnknownError(error).split(/\r?\n/)) {
    const colon =
      /^(.+):\d+:\d+\s+-\s+(?:error|warning|suggestion|message)\s+TS\d+:\s+.+$/i.exec(
        line,
      );
    const parenthesized =
      /^(.+?)\(\d+,\d+\):\s+(?:error|warning|suggestion|message)\s+TS\d+:\s+.+$/i.exec(
        line,
      );
    const file = colon?.[1] ?? parenthesized?.[1];
    if (file !== undefined && file.trim().length !== 0) {
      files.push(file.trim());
    }
  }
  return files;
}
