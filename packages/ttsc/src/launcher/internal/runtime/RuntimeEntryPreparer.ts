import type { RuntimeManifest } from "./RuntimeManifest";

/**
 * Synchronously prepare and type-check a TypeScript root discovered by a host.
 *
 * The input is the resolved native filename supplied by the runtime hook. The
 * returned manifest records the checked emit used for that root and its imports;
 * artifact cleanup remains with the preparation owner. Preparation errors
 * propagate to the requesting import, and the registry copies successful
 * supported metadata without eviction while its module instance remains alive.
 * The structural callback type itself does not authenticate checked preparation.
 *
 * @evidence contracts/common.md#principled-implementation This callback contract requests synchronous checked preparation; the hook admits its returned metadata and requires an owning entry emit before serving. The signature is not a completion certificate, and thrown preparation errors remain import failures.
 * @evidence contracts/common.md#clear-and-simple-design One named callback separates the preparation contract from optional hook configuration without adding a wrapper or changing the callback's parameter variance.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The callback describes the host's supported preparation boundary and introduces no fixture branch, foreign mutation or fallback implementation.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish the requested preparation contract from structural authentication, artifact ownership, propagated errors and instance-owned copied metadata lifetime.
 * @evidence contracts/portability.md#os-neutral-implementation The argument is a native filesystem filename rather than a URL; the returned manifest carries the owning build's resolved directories instead of assuming a separator or case policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type RuntimeEntryPreparer = (filename: string) => RuntimeManifest;
