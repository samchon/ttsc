import * as Diff from "diff-match-patch-es";
import fs from "node:fs";
import path from "node:path";
import MagicString from "magic-string";
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
  find: string | RegExp;
  replacement: string;
}

export async function transformTtsc(
  id: string,
  source: string,
  options: ResolvedTtscUnpluginOptions,
  aliases?: unknown,
): Promise<TtscTransformResult | undefined> {
  const file = path.resolve(stripQuery(id));
  if (isDeclarationFile(file)) {
    return undefined;
  }

  const tsconfig = resolveTsconfig(file, options.project);
  const tsconfigDir = path.dirname(tsconfig);
  const baseUrl = resolveBaseUrl(tsconfigDir, options.compilerOptions);
  const aliasPaths = createAliasPaths(baseUrl, aliases);
  const configured = createTransformTsconfig({
    aliasPaths,
    baseUrl,
    compilerOptions: options.compilerOptions,
    tsconfig,
  });
  try {
    const effectiveTsconfig = configured.path;
    const result = new TtscCompiler({
      cwd: path.dirname(effectiveTsconfig),
      plugins: options.plugins,
      tsconfig: effectiveTsconfig,
    }).transform();
    const code = selectTransformedSource({
      file,
      projectRoot: path.dirname(effectiveTsconfig),
      result,
    });
    return createTransformResult(source, code, file);
  } finally {
    configured.dispose();
  }
}

export function stripQuery(id: string): string {
  const query = id.search(/[?#]/);
  const clean = query === -1 ? id : id.slice(0, query);
  return clean.endsWith("?__rslib_entry__")
    ? clean.slice(0, -"?__rslib_entry__".length)
    : clean;
}

export function isDeclarationFile(id: string): boolean {
  return id.endsWith(".d.ts") || id.endsWith(".d.mts") || id.endsWith(".d.cts");
}

export function createTransformResult(
  source: string,
  code: string,
  id: string,
): TtscTransformResult | undefined {
  if (source === code) {
    return undefined;
  }

  const magic = new MagicString(source);
  const diff = Diff.diff(source, code);
  Diff.diffCleanupSemantic(diff);

  let offset = 0;
  for (let index = 0; index < diff.length; index += 1) {
    const [type, text] = diff[index]!;
    if (type === 0) {
      offset += text.length;
      continue;
    }
    if (type === 1) {
      magic.prependLeft(offset, text);
      continue;
    }

    const next = diff[index + 1];
    if (next?.[0] === 1) {
      magic.update(offset, offset + text.length, next[1]);
      index += 1;
    } else {
      magic.remove(offset, offset + text.length);
    }
    offset += text.length;
  }

  if (!magic.hasChanged()) {
    return undefined;
  }
  return {
    code: magic.toString(),
    map: magic.generateMap({
      file: `${id}.map`,
      includeContent: true,
      source: id,
    }),
  };
}

function createTransformTsconfig(props: {
  aliasPaths: Record<string, string[]>;
  baseUrl: string;
  compilerOptions: Record<string, unknown>;
  tsconfig: string;
}): { path: string; dispose: () => void } {
  const compilerOptions = {
    ...props.compilerOptions,
    ...createAliasCompilerOptions(props),
  };
  if (Object.keys(compilerOptions).length === 0) {
    return {
      path: props.tsconfig,
      dispose: () => undefined,
    };
  }

  const directory = path.dirname(props.tsconfig);
  const file = path.join(
    directory,
    `.ttsc-unplugin-${process.pid}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.json`,
  );
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        extends: `./${path.basename(props.tsconfig)}`,
        compilerOptions,
      },
      null,
      2,
    ),
    "utf8",
  );
  return {
    path: file,
    dispose: () => fs.rmSync(file, { force: true }),
  };
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

function isAlias(value: unknown): value is TtscTransformAlias {
  return (
    typeof value === "object" &&
    value !== null &&
    "find" in value &&
    "replacement" in value &&
    (typeof value.find === "string" || value.find instanceof RegExp) &&
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
