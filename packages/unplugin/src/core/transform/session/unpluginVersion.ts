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
