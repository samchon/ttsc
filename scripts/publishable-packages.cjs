const fs = require("node:fs");
const path = require("node:path");

/**
 * The workspace packages a release publishes, read from their manifests.
 *
 * `package:latest:publish` runs `pnpm -r publish` over `packages/*`, which
 * publishes every package whose manifest is not marked private. The release
 * preflight checks exactly that set's versions, and the full tarball rehearsal
 * packs exactly that set, so both take it from here rather than from a list
 * beside either of them: a new public package, or a platform package for a new
 * platform, enters both at once (samchon/ttsc#1518).
 *
 * A manifest that cannot be parsed is reported, not skipped, so a caller can
 * fail on a package it would otherwise silently leave out.
 *
 * @param {string} root The workspace root.
 * @returns {{
 *   directory: string;
 *   entry: string;
 *   error?: Error;
 *   manifest?: Record<string, unknown>;
 * }[]} Each publishable package, or each manifest that failed to parse, in
 *   directory order.
 */
function listPublishablePackages(root) {
  const packagesDir = path.join(root, "packages");
  const out = [];
  for (const entry of fs.readdirSync(packagesDir).sort()) {
    const directory = path.join(packagesDir, entry);
    const manifestPath = path.join(directory, "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (error) {
      out.push({ directory, entry, error });
      continue;
    }
    if (manifest.private === true) continue;
    if (typeof manifest.name !== "string") continue;
    out.push({ directory, entry, manifest });
  }
  return out;
}

/**
 * Whether a manifest is a platform package: one that restricts itself to an
 * operating system and a CPU, as npm installs only the one matching the host.
 *
 * @param {Record<string, unknown>} manifest
 */
function isPlatformPackage(manifest) {
  return Array.isArray(manifest.os) && Array.isArray(manifest.cpu);
}

module.exports = { isPlatformPackage, listPublishablePackages };
