import type { ITtscLoadedNativePlugin } from "../../../structures/internal/ITtscLoadedNativePlugin";
import { isLinkedTransform } from "./isLinkedTransform";

/**
 * Verifies that all transform plugins in `plugins` either resolve to the same
 * native binary (the common case) after linked sources are removed from the
 * compiler-owner set.
 *
 * Two callers exist with subtly different error wording: the build path
 * (`runBuild`) reports "multiple compiler native backends cannot share one
 * emit pass" while the source-to-source path (`transformProjectInMemory.ts`)
 * reports "cannot share one source-to-source pass". The `pass` argument selects
 * the appropriate phrase so the error message remains diagnostic-grade instead
 * of generic.
 */
export function assertSharedHostCompatibility(
  plugins: readonly ITtscLoadedNativePlugin[],
  pass: "emit" | "source-to-source",
): void {
  const binaries = [...new Set(plugins.map((plugin) => plugin.binary))];
  if (binaries.length <= 1) {
    return;
  }
  const ownerBinaries = [
    ...new Set(
      plugins
        .filter((plugin) => !isLinkedTransform(plugin))
        .map((plugin) => plugin.binary),
    ),
  ];
  if (ownerBinaries.length <= 1) {
    return;
  }
  const phrase =
    pass === "emit"
      ? "multiple compiler native backends cannot share one emit pass"
      : "multiple transform native backends cannot share one source-to-source pass";
  throw new Error(
    "ttsc: " +
      phrase +
      "; compose transform libraries through one aggregate native host",
  );
}
