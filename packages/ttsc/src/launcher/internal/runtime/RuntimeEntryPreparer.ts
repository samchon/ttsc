import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * Synchronously prepare and type-check a TypeScript root discovered by a host.
 *
 * The input is the resolved native filename supplied by the runtime hook. The
 * returned manifest owns the checked emit used for that root and its imports.
 * Preparation errors propagate to the requesting import; the runtime retains
 * the successful manifest for the process lifetime.
 *
 * @evidence contracts/common.md#principled-implementation A synchronous filename-to-manifest signature requires checked preparation before the hook can serve the root; a thrown preparation error remains an import failure rather than an unchecked emit.
 * @evidence contracts/common.md#clear-and-simple-design One named callback separates the preparation contract from optional hook configuration without adding a wrapper or changing the callback's parameter variance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback describes the host's supported preparation boundary and introduces no fixture branch, foreign mutation or fallback implementation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the resolved filename, checked output, failure propagation and successful manifest lifetime following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation The argument is a native filesystem filename rather than a URL; the returned manifest carries the owning build's resolved directories instead of assuming a separator or case policy.
 */
export type RuntimeEntryPreparer = (filename: string) => RuntimeManifest;
