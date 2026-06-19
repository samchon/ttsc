// src/core/index.ts
import { createUnplugin } from "unplugin";

// src/core/options.ts
var defaultOptions = {
  compilerOptions: {},
  plugins: void 0,
  project: void 0
};
function resolveOptions(options = {}) {
  return {
    compilerOptions: { ...options.compilerOptions ?? {} },
    plugins: "plugins" in options ? options.plugins : defaultOptions.plugins,
    project: options.project ?? defaultOptions.project
  };
}

// src/core/transform.ts
import crypto from "node:crypto";
import fs2 from "node:fs";
import os from "node:os";
import path2 from "node:path";
import { TtscCompiler } from "ttsc";

// src/core/tsconfigPaths.ts
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
function readEffectiveTsconfigPaths(tsconfig) {
  const declared = findDeclaredPaths(path.resolve(tsconfig), /* @__PURE__ */ new Set());
  if (declared === null) {
    return {};
  }
  const output = {};
  for (const [key, targets] of Object.entries(declared.paths)) {
    if (!Array.isArray(targets)) {
      continue;
    }
    const absolute = targets.filter((target) => typeof target === "string").map((target) => absolutizePathsTarget(declared.baseDir, target));
    if (absolute.length !== 0) {
      output[key] = absolute;
    }
  }
  return output;
}
function absolutizePathsTarget(baseDir, target) {
  const resolved = path.isAbsolute(target) ? target : path.resolve(baseDir, target);
  return resolved.replace(/\\/g, "/");
}
function findDeclaredPaths(tsconfig, seen) {
  const canonical = resolveRealPath(tsconfig);
  if (seen.has(canonical)) {
    return null;
  }
  seen.add(canonical);
  let parsed;
  try {
    parsed = parseJsonc(fs.readFileSync(canonical, "utf8"));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const own = parsed.compilerOptions?.paths;
  if (typeof own === "object" && own !== null && !Array.isArray(own)) {
    return {
      baseDir: path.dirname(canonical),
      paths: own
    };
  }
  for (const specifier of extendsSpecifiers(parsed.extends).reverse()) {
    const base = resolveExtendsConfig(canonical, specifier);
    if (base === null) {
      continue;
    }
    const declared = findDeclaredPaths(base, seen);
    if (declared !== null) {
      return declared;
    }
  }
  return null;
}
function extendsSpecifiers(extended) {
  if (typeof extended === "string") {
    return [extended];
  }
  if (Array.isArray(extended)) {
    return extended.filter(
      (entry) => typeof entry === "string"
    );
  }
  return [];
}
function resolveExtendsConfig(tsconfig, specifier) {
  if (path.isAbsolute(specifier)) {
    return resolveExistingExtendsPath(specifier);
  }
  if (isRelativeSpecifier(specifier)) {
    return resolveExistingExtendsPath(
      path.resolve(path.dirname(tsconfig), specifier)
    );
  }
  const resolver = createRequire(tsconfig);
  try {
    return resolveRealPath(resolver.resolve(specifier));
  } catch {
    try {
      return resolveRealPath(resolver.resolve(`${specifier}.json`));
    } catch {
      return null;
    }
  }
}
function resolveExistingExtendsPath(location) {
  for (const candidate of /* @__PURE__ */ new Set([
    location,
    `${location}.json`,
    path.join(location, "tsconfig.json")
  ])) {
    if (fs.existsSync(candidate)) {
      return resolveRealPath(candidate);
    }
  }
  return null;
}
function isRelativeSpecifier(specifier) {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith(".\\") || specifier.startsWith("..\\");
}
function resolveRealPath(location) {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}
function parseJsonc(input) {
  const text = input.charCodeAt(0) === 65279 ? input.slice(1) : input;
  return JSON.parse(stripTrailingCommas(stripComments(text)));
}
function stripComments(input) {
  let output = "";
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let quote = "";
  let escape = false;
  for (let i = 0; i < input.length; i += 1) {
    const current = input[i];
    const next = input[i + 1];
    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
        output += current;
      }
      continue;
    }
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (current === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }
    output += current;
  }
  return output;
}
function stripTrailingCommas(input) {
  let output = "";
  let inString = false;
  let quote = "";
  let escape = false;
  for (let i = 0; i < input.length; i += 1) {
    const current = input[i];
    if (inString) {
      output += current;
      if (escape) {
        escape = false;
      } else if (current === "\\") {
        escape = true;
      } else if (current === quote) {
        inString = false;
        quote = "";
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === ",") {
      const next = nextNonWhitespace(input, i + 1);
      if (next === "}" || next === "]") {
        continue;
      }
    }
    output += current;
  }
  return output;
}
function nextNonWhitespace(input, from) {
  for (let i = from; i < input.length; i += 1) {
    const current = input[i];
    if (/\s/.test(current) === false) {
      return current;
    }
  }
  return void 0;
}

// src/core/transform.ts
function createTtscTransformCache() {
  return /* @__PURE__ */ new Map();
}
async function transformTtsc(id, source, options, aliases, cache, hooks) {
  const clean = stripQuery(id);
  if (clean.includes("\0")) {
    return void 0;
  }
  const file = path2.resolve(clean);
  if (isDeclarationFile(file)) {
    return void 0;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return void 0;
  }
  const tsconfig = resolveTsconfig(file, options.project);
  const aliasPaths = createAliasPaths(aliases);
  const key = createTransformCacheKey({
    aliasPaths,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig
  });
  let transformed = cache?.get(key);
  if (transformed !== void 0) {
    const cached = await transformed;
    if (matchesCachedSource(cached, file, source)) {
      reportSuccessDiagnostics(cached.result);
      const code2 = selectTransformedSource({
        file,
        projectRoot: cached.projectRoot,
        result: cached.result
      });
      notifyFileDependencies(hooks, {
        file,
        projectRoot: cached.projectRoot,
        result: cached.result
      });
      return createTransformResult(source, code2);
    }
    cache?.delete(key);
    transformed = void 0;
  }
  if (transformed === void 0) {
    transformed = transformProject({
      aliasPaths,
      compilerOptions: options.compilerOptions,
      currentFile: file,
      currentSource: source,
      plugins: options.plugins,
      tsconfig
    });
    cache?.set(key, transformed);
  }
  const { projectRoot, result } = await transformed;
  reportSuccessDiagnostics(result);
  const code = selectTransformedSource({ file, projectRoot, result });
  notifyFileDependencies(hooks, { file, projectRoot, result });
  return createTransformResult(source, code);
}
function notifyFileDependencies(hooks, props) {
  const addWatchFile = hooks?.addWatchFile;
  if (addWatchFile === void 0) {
    return;
  }
  for (const dependency of selectFileDependencies(props)) {
    addWatchFile(dependency);
  }
}
function selectFileDependencies(props) {
  if (props.result.type === "exception") {
    return [];
  }
  const dependencies = props.result.dependencies;
  if (dependencies === void 0) {
    return [];
  }
  const key = toProjectKey(props.projectRoot, props.file);
  let entries = dependencies[key];
  if (entries === void 0) {
    for (const [candidate, candidateEntries] of Object.entries(dependencies)) {
      if (path2.resolve(props.projectRoot, candidate) === props.file) {
        entries = candidateEntries;
        break;
      }
    }
  }
  if (!Array.isArray(entries)) {
    return [];
  }
  const output = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      continue;
    }
    const absolute = path2.resolve(props.projectRoot, entry);
    if (absolute === props.file || seen.has(absolute)) {
      continue;
    }
    seen.add(absolute);
    output.push(absolute);
  }
  return output;
}
function stripQuery(id) {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}
function isDeclarationFile(id) {
  return id.endsWith(".d.ts") || id.endsWith(".d.mts") || id.endsWith(".d.cts");
}
function pluginsAreDisabled(plugins) {
  return plugins === false || Array.isArray(plugins) && plugins.length === 0;
}
function createTransformResult(source, code) {
  if (source === code) {
    return void 0;
  }
  return { code };
}
function matchesCachedSource(cached, file, source) {
  const currentKey = toProjectKey(cached.projectRoot, file);
  const currentHashes = collectProjectInputHashes(cached.projectRoot);
  currentHashes[currentKey] = hashText(source);
  return sameHashes(cached.inputHashes, currentHashes);
}
function collectInputHashes(props) {
  const hashes = collectProjectInputHashes(props.projectRoot);
  if (props.result.type !== "exception") {
    for (const key of Object.keys(props.result.typescript)) {
      const file = path2.resolve(props.projectRoot, key);
      try {
        hashes[key] = hashText(fs2.readFileSync(file, "utf8"));
      } catch {
      }
    }
  }
  hashes[toProjectKey(props.projectRoot, props.currentFile)] = hashText(
    props.currentSource
  );
  return hashes;
}
function collectProjectInputHashes(projectRoot) {
  const hashes = {};
  for (const file of listProjectInputFiles(projectRoot)) {
    try {
      hashes[toProjectKey(projectRoot, file)] = hashText(fs2.readFileSync(file));
    } catch {
    }
  }
  return hashes;
}
function listProjectInputFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs2.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) {
        continue;
      }
      const file = path2.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(file);
      } else if (entry.isFile()) {
        out.push(file);
      }
    }
  }
  out.sort();
  return out;
}
function isIgnoredProjectDirectory(name2) {
  return name2 === ".git" || name2 === ".ttsc" || name2 === ".cache" || name2 === ".next" || name2 === ".nuxt" || name2 === ".svelte-kit" || name2 === ".turbo" || name2 === ".vite" || name2 === "build" || name2 === "coverage" || name2 === "dist" || name2 === "node_modules" || name2 === "out" || name2 === "temp" || name2 === "tmp";
}
function sameHashes(left, right) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}
function hashText(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
async function transformProject(props) {
  const configured = createTransformTsconfig(props);
  const projectRoot = path2.dirname(props.tsconfig);
  try {
    const result = new TtscCompiler({
      cwd: projectRoot,
      plugins: props.plugins,
      projectRoot,
      tsconfig: configured.path
    }).transform();
    return {
      inputHashes: collectInputHashes({
        currentFile: props.currentFile,
        currentSource: props.currentSource,
        projectRoot,
        result
      }),
      projectRoot,
      result
    };
  } finally {
    configured.dispose();
  }
}
function createTransformTsconfig(props) {
  const compilerOptions = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props)
    },
    path2.dirname(props.tsconfig)
  );
  if (Object.keys(compilerOptions).length === 0) {
    return {
      path: props.tsconfig,
      dispose: () => void 0
    };
  }
  const directory = fs2.mkdtempSync(path2.join(os.tmpdir(), "ttsc-unplugin-"));
  const file = path2.join(directory, "tsconfig.json");
  fs2.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(props.tsconfig),
        compilerOptions
      },
      null,
      2
    ),
    "utf8"
  );
  return {
    path: file,
    dispose: () => fs2.rmSync(directory, { force: true, recursive: true })
  };
}
function normalizeCompilerOptionsForGeneratedTsconfig(compilerOptions, tsconfigDir) {
  const output = { ...compilerOptions };
  for (const key of ["declarationDir", "outDir", "rootDir"]) {
    if (typeof output[key] === "string") {
      output[key] = path2.resolve(tsconfigDir, output[key]);
    }
  }
  for (const key of ["rootDirs", "typeRoots"]) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map(
        (entry) => typeof entry === "string" ? path2.resolve(tsconfigDir, entry) : entry
      );
    }
  }
  const paths = readPaths(output.paths);
  if (Object.keys(paths).length !== 0) {
    output.paths = Object.fromEntries(
      Object.entries(paths).map(([key, targets]) => [
        key,
        targets.map((target) => absolutizePathsTarget(tsconfigDir, target))
      ])
    );
  }
  if (Array.isArray(output.plugins)) {
    output.plugins = output.plugins.map(
      (entry) => normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir)
    );
  }
  return output;
}
function normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output = { ...entry };
  for (const key of ["config", "source", "transform"]) {
    const value = output[key];
    if (typeof value === "string" && isRelativeSpecifier2(value)) {
      output[key] = path2.resolve(tsconfigDir, value);
    }
  }
  return output;
}
function createAliasCompilerOptions(props) {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    paths: {
      ...readEffectiveTsconfigPaths(props.tsconfig),
      ...readPaths(props.compilerOptions.paths),
      ...props.aliasPaths
    }
  };
}
function readPaths(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output = {};
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry) => typeof entry === "string"
    );
    if (filtered.length !== 0) {
      output[key] = filtered;
    }
  }
  return output;
}
function createAliasPaths(aliases) {
  const paths = {};
  for (const alias of normalizeAliases(aliases)) {
    if (typeof alias.find !== "string" || alias.find.length === 0) {
      continue;
    }
    if (alias.find.includes("*")) {
      continue;
    }
    const key = alias.find.replace(/\/+$/, "");
    if (key.length === 0) {
      continue;
    }
    const target = normalizePath(
      path2.isAbsolute(alias.replacement) ? alias.replacement : path2.resolve(process.cwd(), alias.replacement)
    );
    paths[key] = [target];
    paths[`${key}/*`] = [`${target}/*`];
  }
  return paths;
}
function normalizeAliases(aliases) {
  if (Array.isArray(aliases)) {
    return aliases.filter(isAlias);
  }
  if (typeof aliases === "object" && aliases !== null) {
    return Object.entries(aliases).filter(
      (entry) => typeof entry[1] === "string"
    ).map(([find, replacement]) => ({ find, replacement }));
  }
  return [];
}
function createTransformCacheKey(props) {
  return stableStringify({
    aliasPaths: props.aliasPaths,
    compilerOptions: props.compilerOptions,
    plugins: props.plugins,
    tsconfig: path2.resolve(props.tsconfig)
  });
}
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function isRelativeSpecifier2(value) {
  return value === "." || value === ".." || value.startsWith("./") || value.startsWith("../") || value.startsWith(".\\") || value.startsWith("..\\");
}
function isAlias(value) {
  return typeof value === "object" && value !== null && "find" in value && "replacement" in value && typeof value.find === "string" && typeof value.replacement === "string";
}
function selectTransformedSource(props) {
  if (props.result.type === "exception") {
    throw new Error(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new Error(formatDiagnostics(props.result.diagnostics));
  }
  const key = toProjectKey(props.projectRoot, props.file);
  const direct = props.result.typescript[key];
  if (direct !== void 0) {
    return direct;
  }
  for (const [candidate, source] of Object.entries(props.result.typescript)) {
    if (path2.resolve(props.projectRoot, candidate) === props.file) {
      return source;
    }
  }
  throw new Error(`ttsc transform did not return output for ${props.file}`);
}
function reportSuccessDiagnostics(result) {
  if (result.type !== "success" || result.diagnostics === void 0) {
    return;
  }
  const text = formatDiagnostics(result.diagnostics);
  if (text.length !== 0) {
    process.stderr.write(`${text}
`);
  }
}
function formatDiagnostics(diagnostics) {
  if (diagnostics.length === 0) {
    return "ttsc transform failed";
  }
  return diagnostics.map(
    (diag) => [
      diag.file ?? "ttsc",
      diag.line === void 0 ? void 0 : `${diag.line}:${diag.character ?? 1}`,
      diag.messageText
    ].filter((part) => part !== void 0 && part !== "").join(": ")
  ).join("\n");
}
function formatUnknownError(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}
function resolveTsconfig(file, tsconfig) {
  if (tsconfig !== void 0) {
    return path2.isAbsolute(tsconfig) ? tsconfig : path2.resolve(process.cwd(), tsconfig);
  }
  let current = path2.dirname(file);
  while (true) {
    const candidate = path2.join(current, "tsconfig.json");
    if (fs2.existsSync(candidate)) {
      return candidate;
    }
    const parent = path2.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path2.resolve(process.cwd(), "tsconfig.json");
}
function toProjectKey(root, file) {
  return normalizePath(path2.relative(root, file));
}
function normalizePath(file) {
  return file.replace(/\\/g, "/");
}

// src/core/index.ts
var name = "ttsc-unplugin";
var sourceFilePattern = /\.[cm]?tsx?$/;
var nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
var virtualModulePattern = /\0/;
var unpluginFactory = (rawOptions = {}) => {
  const options = resolveOptions(rawOptions);
  const transformCache = createTtscTransformCache();
  let aliases;
  return {
    name,
    enforce: "pre",
    vite: {
      configResolved(config) {
        aliases = config.resolve.alias;
      }
    },
    buildStart() {
      transformCache.clear();
    },
    transformInclude(id) {
      const file = stripQuery(id);
      return isTransformTarget(file);
    },
    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file)) {
        return void 0;
      }
      return transformTtsc(file, source, options, aliases, transformCache, {
        // Register plugin-reported dependencies (the transform envelope's
        // `dependencies` lists) so type-only inputs invalidate this module
        // in watch mode; bundlers erase type-only imports from their own
        // module graph and would otherwise serve stale generated code.
        addWatchFile: (watched) => this.addWatchFile(watched)
      });
    }
  };
};
var unplugin = createUnplugin(unpluginFactory);
var index_default = unplugin;
function isTransformTarget(id) {
  return sourceFilePattern.test(id) && !virtualModulePattern.test(id) && !isDeclarationFile(id) && !nodeModulesPattern.test(id);
}
export {
  createTtscTransformCache,
  index_default as default,
  resolveOptions,
  sourceFilePattern,
  transformTtsc,
  unplugin
};
