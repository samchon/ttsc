import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { readJsonFile } from "./readJsonFile";
import { tsconfigExtendsFileCandidates } from "./tsconfigExtendsFileCandidates";

/**
 * Resolve one `extends` specifier of a tsconfig to the config file it names,
 * by TypeScript-Go's rule (`getExtendsConfigPath`).
 *
 * - A specifier naming a file (rooted, `./`, or `../`, after `\` is folded into
 *   `/`) resolves to the first of its candidates that is a regular file
 *   (`tsconfigExtendsFileCandidates`), under the spelling it was reached by.
 * - Any other specifier is resolved like a module from the declaring config: a
 *   bare package root selects its preset through `package.json#tsconfig`, then
 *   Node's resolver is asked for the specifier and for the specifier with
 *   `.json` appended. A module resolves to its physical path, as TypeScript-Go's
 *   module resolution does.
 *
 * The one rule both of the workspace's config readers use (samchon/ttsc#1489):
 * ttsc's project reader canonicalizes the answer before it reads the chain
 * further, and `@ttsc/unplugin` keeps the spelling, since TypeScript anchors a
 * relatively extended config at the path it was reached by (samchon/ttsc#1455).
 *
 * @param tsconfig The declaring config, as the reader named it.
 * @param specifier The `extends` value as written.
 * @returns The extended config's path.
 * @throws When the specifier names nothing, or a preset's `package.json` does
 *   not parse, naming what failed in ttsc's voice.
 */
export function resolveTsconfigExtends(
  tsconfig: string,
  specifier: string,
): string {
  const files = tsconfigExtendsFileCandidates(tsconfig, specifier);
  if (files !== undefined) {
    for (const candidate of files) {
      if (isFile(candidate)) return candidate;
    }
    throw new Error(`ttsc: extended tsconfig not found: ${files[0]}`);
  }
  const normalized = specifier.replaceAll("\\", "/");
  const resolver = createRequire(tsconfig);
  // A bare package root selects its preset through `package.json#tsconfig`,
  // matching TypeScript's config resolution. Presets shipped this way often
  // have no JavaScript/JSON entrypoint at all, so Node's entrypoint resolver
  // and the `<specifier>.json` fallback below both miss them.
  const viaManifest = resolvePackageManifestTsconfig(resolver, normalized);
  if (viaManifest !== undefined) {
    for (const candidate of viaManifest.endsWith(".json")
      ? [viaManifest]
      : [viaManifest, `${viaManifest}.json`]) {
      if (isFile(candidate)) return resolveRealPath(candidate);
    }
    throw new Error(`ttsc: extended tsconfig not found: ${viaManifest}`);
  }
  try {
    return resolveRealPath(resolver.resolve(normalized));
  } catch {
    return resolveRealPath(resolver.resolve(`${normalized}.json`));
  }
}

/**
 * When `specifier` names a bare package root, resolve the config file its
 * `package.json#tsconfig` field selects (anchored at the package directory).
 * Returns `undefined` when the specifier is a subpath, the manifest cannot be
 * resolved at all, or it declares no `tsconfig` field, so the caller falls back
 * to Node entrypoint resolution. A manifest that resolves but does not parse
 * throws, naming the file.
 */
function resolvePackageManifestTsconfig(
  resolver: NodeRequire,
  specifier: string,
): string | undefined {
  if (!isBarePackageRoot(specifier)) {
    return undefined;
  }
  let manifestPath: string;
  try {
    manifestPath = resolver.resolve(`${specifier}/package.json`);
  } catch (error) {
    // Node parses a package's manifest while resolving into it, so a malformed
    // preset manifest fails here rather than at the read below. Swallowing it
    // is what turned a broken manifest into the confusing downstream
    // "Cannot find module 'example-preset.json'" from the `extends` fallback,
    // which names a file that was never the problem. Node's own message names
    // the real one, so report it in ttsc's voice instead of continuing.
    if (
      (error as NodeJS.ErrnoException | undefined)?.code ===
      "ERR_INVALID_PACKAGE_CONFIG"
    ) {
      throw new Error(
        `ttsc: failed to parse the package manifest of ${JSON.stringify(specifier)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    return undefined;
  }
  // A manifest that exists but does not parse is a real configuration error:
  // falling back to Node entrypoint resolution would tell the user nothing
  // about the file that actually broke. A manifest that parses to something
  // other than an object carries no `tsconfig` field to read, so it falls back
  // rather than throwing on a property access.
  const manifest = readJsonFile(manifestPath);
  const field =
    typeof manifest === "object" && manifest !== null
      ? (manifest as { tsconfig?: unknown }).tsconfig
      : undefined;
  if (typeof field !== "string" || field.length === 0) {
    return undefined;
  }
  return path.resolve(path.dirname(manifestPath), field.replaceAll("\\", "/"));
}

/**
 * Return true when `specifier` is a bare package root (no subpath): a plain
 * package name (`preset`) or a scoped name (`@scope/preset`). Subpaths such as
 * `@scope/preset/base.json` resolve directly and keep their current meaning.
 */
function isBarePackageRoot(specifier: string): boolean {
  if (specifier.startsWith("@")) {
    return specifier.split("/").length === 2;
  }
  return !specifier.includes("/");
}

/** Whether a path is a regular file; any failure to stat counts as not. */
function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve symlinks on `location`, returning the original path when
 * `realpathSync` fails.
 */
function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}
