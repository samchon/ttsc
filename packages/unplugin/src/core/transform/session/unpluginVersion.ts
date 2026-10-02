import { createRequire } from "node:module";

/**
 * The version of this `@ttsc/unplugin`, read once from its own manifest, or
 * `"unknown"` when the manifest cannot be read.
 *
 * A shared compile outlives its publishing process (samchon/ttsc#1483), and
 * this adapter's code decides adoption proof. Its reported package version
 * therefore contributes to sharedCompileIdentity. A distinct string
 * changes that tuple; unknown fallback does not certify identical adapter code.
 * The configured CommonJS/ES module outputs supply the executing module
 * context, and the package resolves its manifest by name through its exports.
 *
 * The first accepted string or unknown fallback is retained for the process.
 * An installation changed after that read is not revalidated here; sharing
 * assumes the executing package and its metadata remain stable for that process.
 *
 * @evidence contracts/common.md#principled-implementation The self-resolved package's reported version string enters retained-publication identity; missing/nonstring metadata is explicitly unknown. This is package metadata, not an independent code fingerprint, so stable executing installation and separate adoption proof remain premises.
 * @evidence contracts/common.md#clear-and-simple-design A single cached manifest lookup provides the version; compiler-version ownership remains in pluginBuildVersions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Package self-resolution uses the installed export contract rather than a guessed checkout path; an unavailable manifest is explicitly represented as unknown.
 * @evidence contracts/common.md#meaningful-documentation The comment explains retained-publication identity and self-resolution under both emitted module formats.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One accepted version string or fallback is retained until process exit with no string-byte cap or invalidation API. Native/module metadata caches belong to Node's loader; this helper owns no file descriptor or historical version list.
 * @evidence contracts/performance.md#efficient-algorithms A completed value needs fixed field access. Cold self-resolution/require can process native paths, package export metadata and manifest bytes before one version-field check; module lookup/read/parse cost is not constant merely because one require expression appears.
 * @evidence contracts/performance.md#reuse-equivalent-work First string or unknown fallback is memoized for every later identity call. This saves repeated lookup under a process-stable executing installation; even a failed first lookup is not retried, and the memo supplies no current package-change detection.
 * @evidence contracts/portability.md#os-neutral-implementation createRequire uses the executing module address and declared package self-export to locate metadata rather than a fixed checkout or separator pattern. The configured CJS/ESM outputs preserve that module context; any unavailable self-resolution yields the documented unknown value, not an invented native package address.
 */
export function unpluginVersion(): string {
  if (VERSION.value === undefined) {
    try {
      const manifest = createRequire(import.meta.url)(
        "@ttsc/unplugin/package.json",
      ) as { version?: unknown };
      VERSION.value =
        typeof manifest.version === "string" ? manifest.version : "unknown";
    } catch {
      VERSION.value = "unknown";
    }
  }
  return VERSION.value;
}

/** The version, once read. */
const VERSION: { value?: string } = {};
