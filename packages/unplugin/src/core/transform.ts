import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  ITtscCompilerDiagnostic,
  ITtscCompilerTransformation,
} from "ttsc";
import { TtscCompiler } from "ttsc";
import type { TransformResult } from "unplugin";

import type { ResolvedTtscUnpluginOptions } from "./options";

export type TtscTransformResult = Exclude<
  TransformResult,
  string | null | undefined
>;

export interface TtscTransformAlias {
  find: string;
  replacement: string;
}

export interface TtscCachedProjectTransform {
  inputHashes: Record<string, string>;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}

export type TtscTransformCache = Map<
  string,
  Promise<TtscCachedProjectTransform>
>;

export function createTtscTransformCache(): TtscTransformCache {
  return new Map();
}

export async function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
  cache?: TtscTransformCache,
): Promise<TtscTransformResult | undefined> {
  const clean = stripQuery(id);
  if (clean.includes("\0")) {
    return undefined;
  }
  const file = path.resolve(clean);
  if (isDeclarationFile(file)) {
    return undefined;
  }
  if (pluginsAreDisabled(options.plugins)) {
    return undefined;
  }

  const tsconfig = resolveTsconfig(file, options.project);
  const tsconfigDir = path.dirname(tsconfig);
  const baseUrl = resolveBaseUrl(tsconfigDir, options.compilerOptions);
  const aliasPaths = createAliasPaths(baseUrl, aliases);
  const key = createTransformCacheKey({
    aliasPaths,
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig,
  });

  let transformed = cache?.get(key);
  if (transformed !== undefined) {
    const cached = await transformed;
    if (matchesCachedSource(cached, file, source)) {
      reportSuccessDiagnostics(cached.result);
      const code = selectTransformedSource({
        file,
        projectRoot: cached.projectRoot,
        result: cached.result,
      });
      return createTransformResult(source, code);
    }
    cache?.delete(key);
    transformed = undefined;
  }

  if (transformed === undefined) {
    transformed = transformProject({
      aliasPaths,
      baseUrl,
      compilerOptions: options.compilerOptions,
      currentFile: file,
      currentSource: source,
      plugins: options.plugins,
      tsconfig,
    });
    cache?.set(key, transformed);
  }
  const { projectRoot, result } = await transformed;
  reportSuccessDiagnostics(result);
  const code = selectTransformedSource({ file, projectRoot, result });
  return createTransformResult(source, code);
}

export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  return query === -1 ? id : id.slice(0, query);
}

export function isDeclarationFile(id: string): boolean {
  return id.endsWith(".d.ts") || id.endsWith(".d.mts") || id.endsWith(".d.cts");
}

function pluginsAreDisabled(
  plugins: ResolvedTtscUnpluginOptions["plugins"],
): boolean {
  return plugins === false || (Array.isArray(plugins) && plugins.length === 0);
}

export function createTransformResult(
  source: string,
  code: string,
): TtscTransformResult | undefined {
  if (source === code) {
    return undefined;
  }
  return { code };
}

function matchesCachedSource(
  cached: TtscCachedProjectTransform,
  file: string,
  source: string,
): boolean {
  const currentKey = toProjectKey(cached.projectRoot, file);
  const currentHashes = collectProjectInputHashes(cached.projectRoot);
  currentHashes[currentKey] = hashText(source);
  return sameHashes(cached.inputHashes, currentHashes);
}

function collectInputHashes(props: {
  currentFile: string;
  currentSource: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): Record<string, string> {
  const hashes = collectProjectInputHashes(props.projectRoot);
  if (props.result.type !== "exception") {
    for (const key of Object.keys(props.result.typescript)) {
      const file = path.resolve(props.projectRoot, key);
      try {
        hashes[key] = hashText(fs.readFileSync(file, "utf8"));
      } catch {
        // A plugin may synthesize a virtual TypeScript file. It should not
        // decide cache reuse for real source files.
      }
    }
  }
  hashes[toProjectKey(props.projectRoot, props.currentFile)] = hashText(
    props.currentSource,
  );
  return hashes;
}

function collectProjectInputHashes(
  projectRoot: string,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const file of listProjectInputFiles(projectRoot)) {
    try {
      hashes[toProjectKey(projectRoot, file)] = hashText(fs.readFileSync(file));
    } catch {
      // File watchers may observe a transform while another process is moving
      // or deleting files. The missing key invalidates older cache entries.
    }
  }
  return hashes;
}

function listProjectInputFiles(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (isIgnoredProjectDirectory(entry.name)) {
        continue;
      }
      const file = path.join(current, entry.name);
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

function isIgnoredProjectDirectory(name: string): boolean {
  return (
    name === ".git" ||
    name === ".ttsc" ||
    name === ".cache" ||
    name === ".next" ||
    name === ".nuxt" ||
    name === ".svelte-kit" ||
    name === ".turbo" ||
    name === ".vite" ||
    name === "build" ||
    name === "coverage" ||
    name === "dist" ||
    name === "node_modules" ||
    name === "out" ||
    name === "temp" ||
    name === "tmp"
  );
}

function sameHashes(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => right[key] === left[key]);
}

function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

async function transformProject(props: {
  aliasPaths: Record<string, string[]>;
  baseUrl: string;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const configured = createTransformTsconfig(props);
  const projectRoot = path.dirname(props.tsconfig);
  try {
    const result = new TtscCompiler({
      cwd: projectRoot,
      plugins: props.plugins,
      projectRoot,
      tsconfig: configured.path,
    }).transform();
    return {
      inputHashes: collectInputHashes({
        currentFile: props.currentFile,
        currentSource: props.currentSource,
        projectRoot,
        result,
      }),
      projectRoot,
      result,
    };
  } finally {
    configured.dispose();
  }
}

function createTransformTsconfig(props: {
  aliasPaths: Record<string, string[]>;
  baseUrl: string;
  compilerOptions: Record<string, unknown>;
  tsconfig: string;
}): { path: string; dispose: () => void } {
  const compilerOptions = normalizeCompilerOptionsForGeneratedTsconfig(
    {
      ...props.compilerOptions,
      ...createAliasCompilerOptions(props),
    },
    path.dirname(props.tsconfig),
  );
  if (Object.keys(compilerOptions).length === 0) {
    return {
      path: props.tsconfig,
      dispose: () => undefined,
    };
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-unplugin-"));
  const file = path.join(directory, "tsconfig.json");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: normalizePath(props.tsconfig),
        compilerOptions,
      },
      null,
      2,
    ),
    "utf8",
  );
  return {
    path: file,
    dispose: () => fs.rmSync(directory, { force: true, recursive: true }),
  };
}

function normalizeCompilerOptionsForGeneratedTsconfig(
  compilerOptions: Record<string, unknown>,
  tsconfigDir: string,
): Record<string, unknown> {
  const output = { ...compilerOptions };
  for (const key of ["baseUrl", "declarationDir", "outDir", "rootDir"]) {
    if (typeof output[key] === "string") {
      output[key] = path.resolve(tsconfigDir, output[key]);
    }
  }
  for (const key of ["rootDirs", "typeRoots"]) {
    if (Array.isArray(output[key])) {
      output[key] = output[key].map((entry) =>
        typeof entry === "string" ? path.resolve(tsconfigDir, entry) : entry,
      );
    }
  }
  if (hasPaths(output.paths) && typeof output.baseUrl !== "string") {
    output.baseUrl = tsconfigDir;
  }
  if (Array.isArray(output.plugins)) {
    output.plugins = output.plugins.map((entry) =>
      normalizePluginConfigForGeneratedTsconfig(entry, tsconfigDir),
    );
  }
  return output;
}

function normalizePluginConfigForGeneratedTsconfig(
  entry: unknown,
  tsconfigDir: string,
): unknown {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return entry;
  }
  const output: Record<string, unknown> = { ...entry };
  for (const key of ["config", "source", "transform"]) {
    const value = output[key];
    if (typeof value === "string" && isRelativeSpecifier(value)) {
      output[key] = path.resolve(tsconfigDir, value);
    }
  }
  return output;
}

function createAliasCompilerOptions(props: {
  aliasPaths: Record<string, string[]>;
  baseUrl: string;
  compilerOptions: Record<string, unknown>;
}): Record<string, unknown> {
  if (Object.keys(props.aliasPaths).length === 0) {
    return {};
  }
  return {
    baseUrl: toCompilerPath(props.baseUrl, props.compilerOptions),
    paths: {
      ...readPaths(props.compilerOptions.paths),
      ...props.aliasPaths,
    },
  };
}

function hasPaths(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length !== 0
  );
}

function readPaths(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const output: Record<string, string[]> = {};
  for (const [key, paths] of Object.entries(value)) {
    if (!Array.isArray(paths)) {
      continue;
    }
    const filtered = paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (filtered.length !== 0) {
      output[key] = filtered;
    }
  }
  return output;
}

function resolveBaseUrl(
  tsconfigDir: string,
  compilerOptions: Record<string, unknown>,
): string {
  return typeof compilerOptions.baseUrl === "string"
    ? path.resolve(tsconfigDir, compilerOptions.baseUrl)
    : tsconfigDir;
}

function toCompilerPath(
  absoluteBaseUrl: string,
  compilerOptions: Record<string, unknown>,
): string {
  return typeof compilerOptions.baseUrl === "string"
    ? compilerOptions.baseUrl
    : absoluteBaseUrl;
}

function createAliasPaths(
  baseUrl: string,
  aliases: unknown,
): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
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
    const replacement = path.isAbsolute(alias.replacement)
      ? alias.replacement
      : path.resolve(process.cwd(), alias.replacement);
    const target = normalizePath(path.relative(baseUrl, replacement) || ".");
    paths[key] = [target];
    paths[`${key}/*`] = [`${target}/*`];
  }
  return paths;
}

function normalizeAliases(aliases: unknown): TtscTransformAlias[] {
  if (Array.isArray(aliases)) {
    return aliases.filter(isAlias);
  }
  if (typeof aliases === "object" && aliases !== null) {
    return Object.entries(aliases)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      )
      .map(([find, replacement]) => ({ find, replacement }));
  }
  return [];
}

function createTransformCacheKey(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  tsconfig: string;
}): string {
  return stableStringify({
    aliasPaths: props.aliasPaths,
    compilerOptions: props.compilerOptions,
    plugins: props.plugins,
    tsconfig: path.resolve(props.tsconfig),
  });
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRelativeSpecifier(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\")
  );
}

function isAlias(value: unknown): value is TtscTransformAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
    typeof value.find === "string" &&
    typeof value.replacement === "string"
  );
}

function selectTransformedSource(props: {
  file: string;
  projectRoot: string;
  result: ITtscCompilerTransformation;
}): string {
  if (props.result.type === "exception") {
    throw new Error(formatUnknownError(props.result.error));
  }
  if (props.result.type === "failure") {
    throw new Error(formatDiagnostics(props.result.diagnostics));
  }

  const key = toProjectKey(props.projectRoot, props.file);
  const direct = props.result.typescript[key];
  if (direct !== undefined) {
    return direct;
  }
  for (const [candidate, source] of Object.entries(props.result.typescript)) {
    if (path.resolve(props.projectRoot, candidate) === props.file) {
      return source;
    }
  }
  throw new Error(`ttsc transform did not return output for ${props.file}`);
}

function reportSuccessDiagnostics(result: ITtscCompilerTransformation): void {
  if (result.type !== "success" || result.diagnostics === undefined) {
    return;
  }
  const text = formatDiagnostics(result.diagnostics);
  if (text.length !== 0) {
    process.stderr.write(`${text}\n`);
  }
}

function formatDiagnostics(diagnostics: ITtscCompilerDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return "ttsc transform failed";
  }
  return diagnostics
    .map((diag) =>
      [
        diag.file ?? "ttsc",
        diag.line === undefined
          ? undefined
          : `${diag.line}:${diag.character ?? 1}`,
        diag.messageText,
      ]
        .filter((part) => part !== undefined && part !== "")
        .join(": "),
    )
    .join("\n");
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

function resolveTsconfig(file: string, tsconfig?: string): string {
  if (tsconfig !== undefined) {
    return path.isAbsolute(tsconfig)
      ? tsconfig
      : path.resolve(process.cwd(), tsconfig);
  }

  let current = path.dirname(file);
  while (true) {
    const candidate = path.join(current, "tsconfig.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  return path.resolve(process.cwd(), "tsconfig.json");
}

function toProjectKey(root: string, file: string): string {
  return normalizePath(path.relative(root, file));
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/");
}
