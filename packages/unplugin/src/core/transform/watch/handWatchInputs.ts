import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * Hand one delivery's watch inputs to the host, each spelling once.
 *
 * The inputs reach here spelled as the host spells the project
 * (`hostSpelling`), which folds the compiler's physical spelling of an input
 * and the adapter's own spelling of the same file, the selected config among
 * them, into one. A host given both would register the file twice, and one
 * comparing its registrations lexically would watch it twice. The first
 * occurrence keeps its evidence, since the compiler's evidence is listed
 * first.
 *
 * @param hooks The host's hooks; nothing is handed when it takes no inputs.
 * @param inputs The inputs in the order they were derived.
 * @param failed Whether they are a failed generation's, for a batching host.
 */
export function handWatchInputs(
  hooks: TtscTransformHooks | undefined,
  inputs: readonly TtscWatchInput[],
  failed?: boolean,
): void {
  const addWatchFile = hooks?.addWatchFile;
  const addWatchFiles = hooks?.addWatchFiles;
  if (addWatchFile === undefined && addWatchFiles === undefined) return;
  const seen = new Set<string>();
  const distinct = inputs.filter((input) => {
    if (seen.has(input.file)) return false;
    seen.add(input.file);
    return true;
  });
  if (addWatchFiles !== undefined) {
    addWatchFiles(distinct, failed);
    return;
  }
  for (const input of distinct) addWatchFile!(input.file, input.evidence);
}
