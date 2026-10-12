import type { ITtscCompilerTransformation } from "ttsc";

import { resultFilesystem } from "../cache/resultFilesystem";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { envelopeDerivation } from "./envelopeDerivation";

/**
 * The directory case answers of one generation's identity context
 * (`envelopeDerivation`), for another identity context built while that
 * generation is captured over the same filesystem view.
 *
 * Capturing a generation builds several identity contexts: the input selections
 * and the trackers' baselines. Each asked every directory's case policy again,
 * which on Windows costs an `fsutil` process for a directory whose names cannot
 * settle it (samchon/ttsc#1742). They now ask the generation's own context,
 * which memoizes each directory once for the generation. A view other than the
 * one registered for the result observes for itself, and a tracker's re-check
 * after an event still builds a context of its own.
 *
 * @evidence contracts/common.md#principled-implementation Sharing is admitted only for the filesystem view registered for the result, the view the generation context observes; any other view keeps its own observations.
 * @evidence contracts/common.md#clear-and-simple-design One selector returns the generation's case operation, or the view's own for another view, and callers pass it to the existing context factory.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No answer is cached beyond the generation context that observed it, and a tracker's event re-check is not routed through it.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the repeated probes, the view condition and the re-check exception.
 * @evidence contracts/portability.md#os-neutral-implementation The generation context observes case policy through the registered view's own probes; no platform assumption is introduced.
 * @evidence contracts/performance.md#efficient-algorithms One registry lookup and one derivation lookup; the returned operation delegates to the generation context's memo.
 * @evidence contracts/performance.md#reuse-equivalent-work Every context capturing one generation shares the generation's answer for each directory.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The answers belong to the generation context, which the generation already owns; this selector retains nothing.
 */
export function generationCaseSensitivity(props: {
  /** The view the caller's context observes through. */
  filesystem: TtscTransformFilesystemOperations;

  /** Native project directory of the generation. */
  projectRoot: string;

  /** The generation's compiler result. */
  result: ITtscCompilerTransformation;
}): TtscTransformFilesystemOperations["caseSensitive"] {
  if (resultFilesystem(props.result) !== props.filesystem)
    return props.filesystem.caseSensitive;
  const context = envelopeDerivation({
    projectRoot: props.projectRoot,
    result: props.result,
  }).identityContext;
  return (directory) => context.caseSensitive(directory);
}
