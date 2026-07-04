import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const extensions = [".ts", ".js", ".mjs", ".cjs"];

export async function resolve(specifier, context, nextResolve) {
  const nextSpecifier = isWindowsAbsoluteFileSpecifier(specifier)
    ? pathToFileURL(specifier).href
    : specifier;
  try {
    return await nextResolve(nextSpecifier, context);
  } catch (error) {
    if (isExtensionlessFileSpecifier(specifier) === false) throw error;

    const base = resolveBasePath(specifier, context.parentURL);
    for (const candidate of candidates(base)) {
      if (isFile(candidate))
        return nextResolve(pathToFileURL(candidate).href, context);
    }
    throw error;
  }
}

function isWindowsAbsoluteFileSpecifier(specifier) {
  return process.platform === "win32" && /^[a-zA-Z]:[\\/]/.test(specifier);
}

function isExtensionlessFileSpecifier(specifier) {
  if (isWindowsAbsoluteFileSpecifier(specifier)) {
    return path.extname(specifier) === "";
  }
  if (specifier.startsWith(".") || specifier.startsWith("/")) {
    return path.extname(specifier) === "";
  }
  if (specifier.startsWith("file:")) {
    return path.extname(fileURLToPath(specifier)) === "";
  }
  return false;
}

function resolveBasePath(specifier, parentURL) {
  if (specifier.startsWith("file:")) return fileURLToPath(specifier);
  if (specifier.startsWith("/")) return specifier;

  const parent =
    parentURL && parentURL.startsWith("file:")
      ? path.dirname(fileURLToPath(parentURL))
      : process.cwd();
  return path.resolve(parent, specifier);
}

function candidates(base) {
  return extensions.flatMap((extension) => [
    `${base}${extension}`,
    path.join(base, `index${extension}`),
  ]);
}

function isFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
