import path from "node:path";

import type { ITtscProjectMembershipPolicy } from "./ITtscProjectMembershipPolicy";
import { OUTPUT_DIRECTORY_OPTIONS } from "./OUTPUT_DIRECTORY_OPTIONS";
import { TsconfigReadTransaction } from "./TsconfigReadTransaction";
import { absolutizePathsTarget } from "./absolutizePathsTarget";
import { findDeclaredFileSpecs } from "./findDeclaredFileSpecs";
import { findDeclaredValue } from "./findDeclaredValue";
import { flattenDirectoryExclusionOrigins } from "./flattenDirectoryExclusionOrigins";
import { normalizeTypeScriptPathSeparators } from "./normalizeTypeScriptPathSeparators";
import { resolveConfigDirTemplatePath } from "./resolveConfigDirTemplatePath";
import { resolveMembershipInputExtensions } from "./resolveMembershipInputExtensions";
import { resolveNativeRootPath } from "./resolveNativeRootPath";
import { resolveRealPath } from "./resolveRealPath";

/** TypeScript-Go's `defaultIncludeSpec`, used when neither list is declared. */
const DEFAULT_INCLUDE_SPEC = "**/*";

/**
 * Read the membership policy the resolved tsconfig implies, following its
 * `extends` chain for every option the answer depends on.
 *
 * Root files follow TypeScript-Go's selection. `files` and `include` each
 * resolve to one list across `extends` as {@link findDeclaredFileSpecs} decides,
 * a declaring config replacing what it inherits rather than adding to it. A
 * config that declares neither gets the default recursive include spec. The
 * root matcher still applies extension, package and hidden-path admission; this
 * policy does not enumerate every dependency in the compiler program.
 *
 * `allowJs` (implicitly enabled by `checkJs`), effective `resolveJsonModule`
 * and declared content mapper extensions prime root-discovery suffixes, not the
 * complete set of imported or externally observed program inputs. `outDir`,
 * `declarationDir`, and plain `exclude` entries supply conservative directory
 * exclusions for that discovery walk. TypeScript supplies the two output
 * directories as implicit exclusions only when no top-level `exclude` replaces
 * that default.
 *
 * A glob in `exclude` is skipped rather than approximated. Failing to exclude
 * costs a walk; excluding the wrong tree hides real sources, and this function
 * refuses to guess in the direction that loses correctness.
 *
 * Source, identity and extends observations share this transaction. Completed
 * selections, including absence, require matching physical ancestry
 * intersections. Later calls start fresh, so unchanged metadata cannot conceal
 * changed source text or resolution.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Config-derived root specs, allowed extensions and exclusion provenance
 *   model compiler selection. Inherited path anchors remain with their owner;
 *   unreadable config roots and unsupported exclusion globs stay conservative.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Shared declaration readers own inheritance; this operation assembles one
 *   policy and keeps extension and exclusion provenance so overlays can recompute defaults. Own null options clear inherited declarations before default resolution.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node native paths anchor config-derived patterns; regular and native
 *   realpath retain separate root aliases, including short-name expansion.
 *   Root matching later uses the compiler's case rule rather than the source OS.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Directory admission comes from configuration rather than a consumer-name
 *   table; unsupported globs cost extra observation instead of hiding sources.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain defaults, output exclusion provenance and the
 *   conservative boundary, plus the graph transaction's per-call lifetime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Graph observations and source sets are local; the returned policy transfers
 *   to its caller and this reader retains no handle or cross-call state.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One transaction observes each lexical config and visited extends specifier
 *   once across keys. Query memoization prevents path-count expansion on DAGs;
 *   source/identity witnesses follow accumulated subtree volume, potentially
 *   quadratic on chains. Changed cycle contexts require evaluation; spec/path
 *   lengths and exclusion count drive anchoring and returned arrays.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Option queries share source, identity and edge observations in this read.
 *   Later calls use a fresh owner because unchanged metadata does not prove source
 *   equivalence; the selection-entry owner validates cross-call memoization.
 */
export function readProjectMembershipPolicy(
  tsconfig: string,
): ITtscProjectMembershipPolicy {
  const resolved = path.resolve(tsconfig);
  // Every config the chain touches, so a caller memoizing this policy can tell
  // when it has gone stale. Each query retains its selection semantics and
  // records its inputs while graph observations share this read's transaction.
  const sources = new Set<string>();
  const configs = new TsconfigReadTransaction();
  const files = findDeclaredFileSpecs(resolved, "files", sources, configs);
  const include = findDeclaredFileSpecs(resolved, "include", sources, configs);
  const configDir = path.dirname(resolved);
  const absolutize = (
    declared: { baseDir: string; specs: string[] } | undefined,
  ): string[] | undefined =>
    declared?.specs.map((entry) =>
      absolutizePathsTarget(declared.baseDir, entry, configDir),
    );
  // TypeScript-Go substitutes `include: ["**/*"]` exactly when neither list
  // resolves to an array, so the permissive answer is kept only for a config
  // that cannot be read at all. A files-only project has no implicit include,
  // whereas include and files together form a union.
  const rootFileSpecs =
    files === null || include === null
      ? undefined
      : {
          files: absolutize(files) ?? [],
          include:
            absolutize(include) ??
            (files === undefined
              ? [absolutizePathsTarget(configDir, DEFAULT_INCLUDE_SPEC)]
              : []),
          root: {
            path: configDir,
            realpath: resolveRealPath(configDir),
            nativepath: resolveNativeRootPath(configDir),
          },
        };
  const option = (key: string): unknown =>
    findDeclaredValue(
      resolved,
      (parsed) => {
        const options = (
          parsed as { compilerOptions?: Record<string, unknown> }
        ).compilerOptions;
        // Boxing null stops inheritance: upstream clears the inherited value.
        return options !== null &&
          typeof options === "object" &&
          Object.hasOwn(options, key)
          ? { value: options[key] }
          : undefined;
      },
      new Set(),
      sources,
      configs,
    )?.value.value;
  const booleanOption = (key: string): boolean | undefined => {
    const value = option(key);
    return typeof value === "boolean" ? value : undefined;
  };
  const stringOption = (key: string): string | undefined => {
    const value = option(key);
    return typeof value === "string" ? value : undefined;
  };
  const extensions = new Set<string>();
  const mappers =
    findDeclaredValue(
      resolved,
      (parsed) => {
        if (!Object.prototype.hasOwnProperty.call(parsed, "contentMappers"))
          return undefined;
        const value = (parsed as { contentMappers?: unknown }).contentMappers;
        return Array.isArray(value) ? value : [];
      },
      new Set(),
      sources,
      configs,
    )?.value ?? [];
  for (const mapper of mappers) {
    const declaredExtensions =
      mapper !== null && typeof mapper === "object"
        ? (mapper as { extensions?: unknown }).extensions
        : undefined;
    if (!Array.isArray(declaredExtensions)) continue;
    for (const extension of declaredExtensions)
      if (
        typeof extension === "string" &&
        extension.length > 1 &&
        extension.startsWith(".") &&
        !/[\\/]/.test(extension)
      )
        extensions.add(extension.toLowerCase());
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
          typeof options !== "object" ||
          options === null ||
          Array.isArray(options) ||
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
      configs,
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
    configs,
  );
  const excludeList = findDeclaredFileSpecs(
    resolved,
    "exclude",
    sources,
    configs,
  );
  directoryExclusionOrigins.useImplicitOutputExclusions =
    excludeList === undefined || excludeList === null
      ? excluded === null || excluded.value.value === null
      : false;
  if (excludeList !== null && excludeList !== undefined) {
    for (const entry of excludeList.specs) {
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
          excludeList.baseDir,
          plain,
          path.dirname(resolved),
        ),
      );
    }
  }
  const extensionOptionOrigins = {
    allowJs: booleanOption("allowJs"),
    checkJs: booleanOption("checkJs"),
    resolveJsonModule: booleanOption("resolveJsonModule"),
    module: stringOption("module"),
    moduleResolution: stringOption("moduleResolution"),
    mapperExtensions: [...extensions],
  };
  return {
    rootFileSpecs,
    directoryExclusionOrigins,
    excludedDirectories: flattenDirectoryExclusionOrigins(
      directoryExclusionOrigins,
    ),
    extensionOptionOrigins,
    inputExtensions: resolveMembershipInputExtensions(extensionOptionOrigins),
    sources: [...sources],
  };
}
