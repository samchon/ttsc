import fs from "node:fs";
import path from "node:path";

/** TypeScript source extensions ttsx compiles instead of letting Node load. */
export const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

/** JavaScript output extensions a TypeScript source can be paired with. */
export const JAVASCRIPT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"] as const;

/** True when `file` exists and is a regular file. */
export function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/** True when `file` carries a TypeScript source extension. */
export function isTypeScriptSource(file: string): boolean {
  return TYPESCRIPT_EXTENSIONS.some((extension) => file.endsWith(extension));
}

/** True when `file` carries a JavaScript output extension. */
export function isJavaScriptOutput(file: string): boolean {
  return /\.(?:[cm]?jsx?)$/i.test(file);
}

/**
 * Return the TypeScript counterpart of a JavaScript module path, or `null` when
 * none exists on disk. Mirrors TypeScript's own `.js`→`.ts` mapping: `.mjs`
 * pairs with `.mts`, `.cjs` with `.cts`, and a plain `.js`/`.jsx` with
 * `.ts`/`.tsx`. The extensionless stem is also probed so an entry target like
 * `./index.js` resolves to `index.ts` when only the source is published.
 */
export function typeScriptCounterpart(jsFile: string): string | null {
  const candidates = counterpartCandidates(jsFile);
  for (const candidate of candidates) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function counterpartCandidates(jsFile: string): string[] {
  const lower = jsFile.toLowerCase();
  if (lower.endsWith(".mjs")) {
    return [replaceExtension(jsFile, ".mts")];
  }
  if (lower.endsWith(".cjs")) {
    return [replaceExtension(jsFile, ".cts")];
  }
  if (lower.endsWith(".jsx")) {
    return [replaceExtension(jsFile, ".tsx"), replaceExtension(jsFile, ".ts")];
  }
  if (lower.endsWith(".js")) {
    return [replaceExtension(jsFile, ".ts"), replaceExtension(jsFile, ".tsx")];
  }
  return [];
}

function replaceExtension(file: string, extension: string): string {
  return file.slice(0, file.length - path.extname(file).length) + extension;
}

/**
 * Resolve an extensionless module target to an existing JavaScript file, or
 * `null` when none exists. Mirrors Node's own probe order (file with each JS
 * extension, then a directory `index`), and is what rescues an extensionless
 * relative import inside compiled output that the ESM resolver rejects.
 */
export function javaScriptForTarget(target: string): string | null {
  if (isJavaScriptOutput(target)) {
    return isFile(target) ? target : null;
  }
  for (const extension of JAVASCRIPT_EXTENSIONS) {
    if (isFile(target + extension)) {
      return target + extension;
    }
  }
  for (const extension of JAVASCRIPT_EXTENSIONS) {
    const indexed = path.join(target, `index${extension}`);
    if (isFile(indexed)) {
      return indexed;
    }
  }
  return null;
}

/**
 * True when `file` lives inside a real `node_modules` package. A
 * `node_modules/.cache` segment does not count: ttsx writes its own caches
 * under `node_modules/.cache`, and those compiled artifacts must not be
 * mistaken for a raw dependency. A genuine dependency always has a deeper
 * `node_modules/<pkg>` segment, so it is still detected.
 */
export function isUnderNodeModules(file: string): boolean {
  const segments = file.split(path.sep);
  for (let i = 0; i < segments.length - 1; i += 1) {
    if (segments[i] === "node_modules" && segments[i + 1] !== ".cache") {
      return true;
    }
  }
  return false;
}

/**
 * Walk upward from `file` to the nearest directory that owns a `package.json`,
 * returning that directory's real path. Returns `null` when no manifest is
 * found before the filesystem root. The real path is used so a package reached
 * through a workspace symlink keys to the same on-disk cache regardless of
 * which `node_modules` link routed to it.
 */
export function findOwningPackageRoot(file: string): string | null {
  let current = path.dirname(file);
  while (true) {
    if (isFile(path.join(current, "package.json"))) {
      return realPath(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

/** Resolve symlinks on `location`, falling back to the input when it fails. */
export function realPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

/** True when `child` is `parent` itself or nested beneath it. */
export function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
