/**
 * Module hooks for the repository's own TypeScript tooling: the test suites,
 * the benchmark harnesses, and the scripts `node-strip-types.cjs` runs.
 *
 * `resolve` accepts the extensionless relative specifiers those sources use
 * (one declaration per file). `load` compiles each `.ts`, `.mts` and `.cts`
 * module with the TypeScript compiler's single-file transpiler, so the
 * namespaces, enums, and parameter properties the repository's conventions use
 * run on every supported Node. Node 26 removed `--experimental-transform-types`
 * and the `transform` mode of `module.stripTypeScriptTypes`, and its type
 * stripping rejects that syntax, so Node alone can no longer run these sources
 * (samchon/ttsc#1574).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "ts-legacy";

const extensions = [".ts", ".js", ".mjs", ".cjs"];

/**
 * Serve every TypeScript module compiled, for `import` and `require()` alike.
 *
 * The hooks are registered with `module.registerHooks`, whose synchronous hooks
 * also see `require()`: `@nestia/e2e`'s CommonJS build loads each test file
 * through `require()`, which asynchronous `module.register` hooks never see.
 * The source is read here rather than taken from `nextLoad`, because Node's
 * default load may already type-strip it to detect its format, and stripping
 * rejects the syntax this hook exists to compile.
 */
export function load(url, context, nextLoad) {
  if (!url.startsWith("file:")) return nextLoad(url, context);
  const filename = fileURLToPath(url);
  const format = typescriptFormat(filename);
  if (format === undefined) return nextLoad(url, context);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      inlineSourceMap: true,
      inlineSources: true,
      module:
        format === "module" ? ts.ModuleKind.ESNext : ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ESNext,
    },
    fileName: filename,
  });
  return { format, shortCircuit: true, source: output.outputText };
}

export function resolve(specifier, context, nextResolve) {
  // `require()` resolves filesystem paths and refuses a `file:` URL, while an
  // ESM import needs a URL for a Windows drive path.
  const requiring = hasCondition(context, "require");
  const nextSpecifier =
    !requiring && isWindowsAbsoluteFileSpecifier(specifier)
      ? pathToFileURL(specifier).href
      : specifier;
  try {
    return nextResolve(nextSpecifier, context);
  } catch (error) {
    if (isExtensionlessFileSpecifier(specifier) === false) throw error;

    const base = resolveBasePath(specifier, context.parentURL);
    for (const candidate of candidates(base)) {
      if (isFile(candidate))
        return nextResolve(
          requiring ? candidate : pathToFileURL(candidate).href,
          context,
        );
    }
    throw error;
  }
}

/** Whether a hook context carries `condition`, given as an array or a set. */
function hasCondition(context, condition) {
  for (const entry of context.conditions ?? [])
    if (entry === condition) return true;
  return false;
}

/**
 * The module format Node gives a TypeScript file, or `undefined` for any other
 * file: `.mts` is ESM and `.cts` CommonJS; a `.ts` follows the nearest
 * `package.json` `"type"`, and without one, whether it has module syntax.
 */
function typescriptFormat(filename) {
  if (filename.endsWith(".d.ts")) return undefined;
  switch (path.extname(filename)) {
    case ".mts":
      return "module";
    case ".cts":
      return "commonjs";
    case ".ts":
      break;
    default:
      return undefined;
  }
  const type = packageType(path.dirname(filename));
  if (type === "module" || type === "commonjs") return type;
  const file = ts.createSourceFile(
    filename,
    fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.ESNext,
  );
  return file.externalModuleIndicator === undefined ? "commonjs" : "module";
}

/** The `"type"` of the nearest `package.json` at or above `directory`. */
function packageType(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    const manifest = path.join(current, "package.json");
    if (isFile(manifest)) {
      try {
        return JSON.parse(fs.readFileSync(manifest, "utf8")).type;
      } catch {
        return undefined;
      }
    }
    if (path.dirname(current) === current) return undefined;
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
