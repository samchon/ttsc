/**
 * Module hooks for the repository's own TypeScript tooling: the test suites,
 * the benchmark harnesses, and the scripts `node-strip-types.cjs` runs.
 *
 * `resolve` accepts the extensionless relative specifiers those sources use
 * (one declaration per file). `load` compiles each TypeScript module Node hands
 * back as `module-typescript` or `commonjs-typescript` with the TypeScript
 * compiler's single-file transpiler, so the namespaces, enums, and parameter
 * properties the repository's conventions use run on every supported Node. Node
 * 26 removed `--experimental-transform-types` and the `transform` mode of
 * `module.stripTypeScriptTypes`, and its type stripping rejects that syntax,
 * so Node alone can no longer run these sources (samchon/ttsc#1574).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "ts-legacy";

const extensions = [".ts", ".js", ".mjs", ".cjs"];

/** The runtime format of each TypeScript format Node's default load reports. */
const TYPESCRIPT_FORMATS = {
  "commonjs-typescript": "commonjs",
  "module-typescript": "module",
};

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  const format = TYPESCRIPT_FORMATS[result.format];
  if (format === undefined) return result;
  const source =
    typeof result.source === "string"
      ? result.source
      : Buffer.from(result.source).toString("utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      inlineSourceMap: true,
      inlineSources: true,
      module:
        format === "module" ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext,
    },
    fileName: fileURLToPath(url),
  });
  return { format, shortCircuit: true, source: output.outputText };
}

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
