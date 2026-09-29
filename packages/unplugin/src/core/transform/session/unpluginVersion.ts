import { createRequire } from "node:module";

/**
 * The version of this `@ttsc/unplugin`, read once from its own manifest, or
 * `"unknown"` when the manifest cannot be read.
 *
 * A shared compile outlives the process that published it (samchon/ttsc#1483),
 * and what an adopter proves of it, and how, is this adapter's own code: an
 * envelope published by another version of it is never adopted
 * (`sharedCompileIdentity`). Rollup rewrites `import.meta.url` for the CommonJS
 * and ES module builds alike, and the package resolves itself by name through
 * its `exports`.
 *
 * @evidence contracts/common.md#principled-implementation The executing package's manifest version enters retained-publication identity, so adapter changes do not silently share another version's proof implementation.
 * @evidence contracts/common.md#clear-and-simple-design A single cached manifest lookup provides the version; compiler-version ownership remains in pluginBuildVersions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Package self-resolution uses the installed export contract rather than a guessed checkout path; an unavailable manifest is explicitly represented as unknown.
 * @evidence contracts/common.md#meaningful-documentation The comment explains retained-publication identity and self-resolution under both emitted module formats.
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
