import path from "node:path";

import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { formatUnknownError } from "../diagnostics/formatUnknownError";
import { envelopeDerivation } from "../envelope/envelopeDerivation";
import { hostSpelling } from "../envelope/hostSpelling";
import { isTransformScratchInput } from "../tsconfig/isTransformScratchInput";
import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";
import type { TtscWatchSelection } from "./TtscWatchSelection";
import { evidencedWatchInput } from "./evidencedWatchInput";
import { handWatchInputs } from "./handWatchInputs";
import { notifyProjectRecord } from "./notifyProjectRecord";
import { projectMembershipInput } from "./projectMembershipInput";
import { selectionInputs } from "./selectionInputs";

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
 *
 * @param file The delivered module, as the host spelled it, which decides the
 *   spelling every input is handed under (`hostSpelling`).
 * @param selection The configs that routed the file to its project, handed
 *   beside the failed generation's inputs.
 *
 * @evidence contracts/common.md#principled-implementation Failed deliveries retain walked/external inputs, named diagnostic paths and the known selected config alongside consulted routing configs, even when optional envelope lists omit it. Ordinary recovery paths omit generation evidence that a replayed failure did not revalidate; separately captured membership can still accompany them, while project-record delivery maps available retained facts under its own contract.
 * @evidence contracts/common.md#clear-and-simple-design One append boundary owns scratch exclusion and lexical deduplication; module recovery and project-record delivery share the same routing observations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Diagnostic extraction accepts only supported TypeScript forms, and recovery absence is explicit rather than fabricated successful state or fixture-specific paths.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain recovery, external-path coverage and failed evidence ownership; parameter prose and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and host spelling preserve absolute external paths, including drive-letter diagnostic forms; project-record locations remain host-selected capabilities.
 * @evidence contracts/performance.md#efficient-algorithms Every call materializes project hash keys and scans retained external/diagnostic entries. Each occurrence pays path/scratch/key text work before accepted paths create ordinary carriers and recorded spellings. Exception extraction formats/splits text and runs two anchored diagnostic patterns per line; matching and caller conversion costs are not a fixed per-diagnostic operation. Routing byte/native observations, optional membership encoding, lazy record evidence/persistence and callback effects add delegated work. Arrays/sets and formatted lines retain their respective populations/text; routing evidence is shared between current notification branches.
 * @evidence contracts/performance.md#reuse-equivalent-work notifyProjectRecord owns qualified generation snapshot/accepted-revision sharing; its input callback is derived only when required. This recovery traversal and host callback effects still run per delivery, with current routing observations added separately. No matching failure message or quiet watcher authorizes skipping the notification effect.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This delivery owns only local arrays and sets; the project-record and host watcher owners retain or release the transferred dependencies.
 */
export function notifyFailedGenerationInputs(
  hooks: TtscTransformHooks | undefined,
  cached: TtscCachedProjectTransform,
  file: string,
  selection: TtscWatchSelection,
): void {
  if (
    hooks === undefined ||
    (hooks.project === undefined &&
      hooks.addWatchFile === undefined &&
      hooks.addWatchFiles === undefined)
  ) {
    return;
  }
  const state = envelopeDerivation(cached);
  const spell = hostSpelling(state.project, file);
  const inputs: TtscWatchInput[] = [];
  // The same paths as the compiler spelled them, for the record: what the
  // failed generation did record of each, its walk hash or external state, is
  // what the record holds, read again only where it recorded nothing.
  const recorded: string[] = [];
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
    inputs.push({ file: spell(spelling) });
    recorded.push(spelling);
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
  const routedInputs = selectionInputs(
    [...new Set([...selection.consulted, selection.tsconfig])],
    selection.filesystem,
    (input) => input,
  );
  for (const entryToAppend of routedInputs.map((input) => ({ ...input, file: spell(input.file) }))) inputs.push(entryToAppend);
  // A build host takes the record, written to what the failed compile
  // consulted, so the repair moves it wherever it lands; a module handed over
  // without it depends on its own bytes alone, and no persistent cache may
  // keep it.
  if (
    hooks.project !== undefined &&
    !notifyProjectRecord(
      hooks.project,
      cached,
      true,
      () =>
        recorded.map((input) =>
          evidencedWatchInput(cached, state, input, (spelling) => spelling),
        ),
      routedInputs,
    )
  ) {
    hooks.markVolatile?.();
  }
  if (hooks.addWatchFile === undefined && hooks.addWatchFiles === undefined) {
    return;
  }
  // A root file the tsconfig includes, such as the global declaration the
  // failed compile was missing, can repair it too (samchon/ttsc#1419).
  const membership =
    hooks.membership === true ? projectMembershipInput(cached) : undefined;
  handWatchInputs(
    hooks,
    membership === undefined ? inputs : [...inputs, membership],
    true,
  );
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
