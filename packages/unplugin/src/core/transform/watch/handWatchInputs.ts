import type { TtscTransformHooks } from "./TtscTransformHooks";
import type { TtscWatchInput } from "./TtscWatchInput";

/**
 * Hand one delivery's watch inputs to the host, each spelling once.
 *
 * The inputs reach here spelled as the host spells the project
 * (`hostSpelling`), which folds the compiler's physical spelling of an input
 * and the adapter's own spelling of the same file, the selected config among
 * them, into one. A host given both would register the file twice, and one
 * comparing its registrations lexically would watch it twice.
 *
 * One spelling can arrive more than once with different evidence, and the
 * registration that carries the most is the one handed over: the project's
 * root-file membership before anything else for the project root, and an
 * evidenced input before a plain one. A graph lists the project root itself as
 * a resolution input, so a failed generation's recovery list named it plainly
 * before its membership, and keeping the first occurrence dropped the
 * membership: nothing then observed a root file appearing, and an input deleted
 * and recreated under a watching Next.js session was never heard again. The
 * order the inputs were derived in decides nothing else; among equals the first
 * stays, so the compiler's evidence, listed first, wins over the adapter's for
 * one file.
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
  const chosen = new Map<string, TtscWatchInput>();
  for (const input of inputs) {
    const kept = chosen.get(input.file);
    if (kept === undefined || rank(input) > rank(kept)) {
      chosen.set(input.file, input);
    }
  }
  const distinct = [...chosen.values()];
  if (addWatchFiles !== undefined) {
    addWatchFiles(distinct, failed);
    return;
  }
  for (const input of distinct) addWatchFile!(input.file, input.evidence);
}

/** How much a registration says about its path: membership, evidence, nothing. */
function rank(input: TtscWatchInput): number {
  if (input.evidence?.state?.codec === "membership") return 2;
  return input.evidence === undefined ? 0 : 1;
}
