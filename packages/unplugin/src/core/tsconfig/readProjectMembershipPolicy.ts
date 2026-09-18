import path from "node:path";

import { TYPESCRIPT_TRANSFORM_EXTENSIONS } from "../source/TYPESCRIPT_TRANSFORM_EXTENSIONS";
import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { JAVASCRIPT_INPUT_EXTENSIONS } from "./JAVASCRIPT_INPUT_EXTENSIONS";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";
import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredValue } from "./findDeclaredValue";
import { flattenDirectoryExclusionOrigins } from "./flattenDirectoryExclusionOrigins";
import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";
import { resolveNativeRootPath } from "./resolveNativeRootPath";
import { resolveRealPath } from "./resolveRealPath";

/**
 * Read the membership policy the resolved tsconfig implies, following its
 * `extends` chain for every option the answer depends on.
 *
 * `allowJs` and `resolveJsonModule` decide which extensions can enter the
 * program at all, so a `bundle.a1b2c3.js` emitted beside the sources is not a
 * membership change for a project that admits no JavaScript. `outDir`,
 * `declarationDir`, and the plain entries of `exclude` name the directories the
 * program does not contain. TypeScript supplies the two output directories as
 * implicit exclusions only when no top-level `exclude` replaces that default.
 *
 * A glob in `exclude` is skipped rather than approximated. Failing to exclude
 * costs a walk; excluding the wrong tree hides real sources, and this function
 * refuses to guess in the direction that loses correctness.
 */
export function readProjectMembershipPolicy(
  tsconfig: string,
): ITtscProjectMembershipPolicy {
  const resolved = path.resolve(tsconfig);
  // Every config the chain touches, so a caller memoizing this policy can tell
  // when it has gone stale. `findDeclaredValue` walks `extends` for each option
  // independently, and each walk records what it read.
  const sources = new Set<string>();
  const fileSpec = (key: "files" | "include") =>
    findDeclaredValue(
      resolved,
      (parsed) =>
        Object.prototype.hasOwnProperty.call(parsed, key)
          ? { value: (parsed as Record<string, unknown>)[key] }
          : undefined,
      new Set(),
      sources,
    );
  const files = fileSpec("files");
  const include = fileSpec("include");
  const resolveSpecs = (
    declared: ReturnType<typeof fileSpec>,
  ): string[] | undefined => {
    if (declared === null || declared.value.value == null) return undefined;
    const value = declared.value.value;
    if (
      !Array.isArray(value) ||
      !value.every((entry) => typeof entry === "string")
    )
      return undefined;
    return value.map((entry) =>
      absolutizePathsTarget(declared.baseDir, entry, path.dirname(resolved)),
    );
  };
  const explicitFiles = resolveSpecs(files);
  const includes = resolveSpecs(include);
  const root = {
    path: path.dirname(resolved),
    realpath: resolveRealPath(path.dirname(resolved)),
    nativepath: resolveNativeRootPath(path.dirname(resolved)),
  };
  // Missing/invalid specs keep the wide fallback. A files-only project has no
  // implicit include, whereas include and files together form a union.
  const rootFileSpecs =
    includes !== undefined
      ? { files: explicitFiles ?? [], include: includes, root }
      : explicitFiles !== undefined &&
          (include === null || include.value.value == null)
        ? { files: explicitFiles, include: [], root }
        : undefined;
  const flag = (key: string): boolean =>
    findDeclaredValue(
      resolved,
      (parsed) => {
        const value = (parsed as { compilerOptions?: Record<string, unknown> })
          .compilerOptions?.[key];
        return typeof value === "boolean" ? value : undefined;
      },
      new Set(),
      sources,
    )?.value === true;

  const inputExtensions = [...TYPESCRIPT_TRANSFORM_EXTENSIONS];
  if (flag("allowJs")) {
    inputExtensions.push(...JAVASCRIPT_INPUT_EXTENSIONS);
  }
  if (flag("resolveJsonModule")) {
    inputExtensions.push(".json");
  }

  const directoryExclusionOrigins: {
    declarationDir?: string;
    exclude: string[];
    outDir?: string;
    useImplicitOutputExclusions: boolean;
  } = { exclude: [], useImplicitOutputExclusions: true };
  for (const key of OUTPUT_DIRECTORY_OPTIONS) {
    const declared = findDeclaredValue(
      resolved,
      (parsed) => {
        const options = (
          parsed as { compilerOptions?: Record<string, unknown> }
        ).compilerOptions;
        if (
          options === undefined ||
          !Object.prototype.hasOwnProperty.call(options, key)
        ) {
          return undefined;
        }
        const value = options[key];
        return typeof value === "string" || value === null
          ? { value }
          : undefined;
      },
      new Set(),
      sources,
    );
    if (declared !== null && declared.value.value !== null) {
      directoryExclusionOrigins[key] = resolveConfigDirTemplatePath(
        declared.baseDir,
        declared.value.value,
        path.dirname(resolved),
      );
    }
  }
  const excluded = findDeclaredValue(
    resolved,
    (parsed) => {
      if (!Object.prototype.hasOwnProperty.call(parsed, "exclude")) {
        return undefined;
      }
      return { value: (parsed as { exclude?: unknown }).exclude };
    },
    new Set(),
    sources,
  );
  directoryExclusionOrigins.useImplicitOutputExclusions =
    excluded === null || excluded.value.value === null;
  if (excluded !== null && Array.isArray(excluded.value.value)) {
    for (const entry of excluded.value.value) {
      if (typeof entry !== "string" || entry.length === 0) {
        continue;
      }
      // `dist/**` names exactly one directory; `**/*.spec.ts` names a set this
      // walk cannot evaluate without a matcher, so it is left in.
      const normalizedEntry = normalizeTypeScriptPathSeparators(entry);
      const plain = normalizedEntry.endsWith("/**")
        ? normalizedEntry.slice(0, -3)
        : normalizedEntry;
      if (plain.length === 0 || /[*?]/.test(plain)) {
        continue;
      }
      directoryExclusionOrigins.exclude.push(
        resolveConfigDirTemplatePath(
          excluded.baseDir,
          plain,
          path.dirname(resolved),
        ),
      );
    }
  }
  return {
    rootFileSpecs,
    directoryExclusionOrigins,
    excludedDirectories: flattenDirectoryExclusionOrigins(
      directoryExclusionOrigins,
    ),
    inputExtensions,
    sources: [...sources],
  };
}
