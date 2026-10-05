import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readJsonFile } from "../../../compiler/internal/project/readJsonFile";
import { isRelativePluginSpecifier } from "./isRelativePluginSpecifier";
import { moduleResolutionBaseSelects } from "./moduleResolutionBaseSelects";

/**
 * How ttsc finds a plugin package and reads its manifest.
 *
 * A plugin is named in `tsconfig.json` or discovered through a direct
 * dependency's `package.json`. Resolution follows Node's own rules with one
 * addition, the `ttsc` export condition, which lets a package point plugin
 * loading at a runtime-free descriptor instead of its runtime barrel.
 *
 * @evidence contracts/common.md#principled-implementation Ordinary package resolution remains Node-owned; only explicit ttsc export opt-in uses the local target algorithm, preserving pattern precedence, condition order, blocked targets and invalid-target errors.
 * @evidence contracts/common.md#clear-and-simple-design The namespace centralizes manifest discovery and plugin-only export selection without changing process-wide module conditions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The ttsc condition is a supported package contract; an opted-in invalid or missing target does not fall back to a runtime barrel that the package intentionally excluded.
 * @evidence contracts/common.md#meaningful-documentation Native comments explain direct/hoisted discovery, dedicated-condition scope, target errors and physical identity; private target helpers document their semantic premises with separated prose under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native joins/relative/realpath and Node resolution preserve OS-neutral paths; slash-based package/export grammar remains distinct from native path boundaries and escape checks.
 * @evidence contracts/performance.md#efficient-algorithms Selected operations account for native ancestor/search-root queries, manifest/name/path bytes and JSON target traversal. Wildcard selection retains the highest-ranked key without sorting, but complete key classification/comparison, recursive substitution/condition inspection and native target queries still contribute work; key count alone is not a processing ceiling.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This resolver owns current filesystem discovery, not a cross-call answer cache; descriptor/capability caches validate the resulting observed inputs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The grouping's private four-name condition list is fixed module policy, not a growing answer history or handle owner. Query arrays/records are owned by selected operations and returned values transfer to callers; persistent entries and process lifetimes belong to other owners.
 */
export namespace PluginPackageResolution {
  /**
   * The fields of a `package.json` plugin discovery reads.
   *
   * @evidence contracts/common.md#principled-implementation Unknown-valued manifest fields preserve untrusted JSON until each consuming resolver validates its own required shape; dependency maps expose names without assuming version value syntax.
   * @evidence contracts/common.md#clear-and-simple-design The subset includes only discovery/export fields and leaves unrelated package metadata out of this internal contract.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An open exports/ttsc value is not an acceptance assertion; actual consumers validate it instead of casting a known package's fixture shape.
   * @evidence contracts/common.md#meaningful-documentation Native member comments identify runtime/dev discovery, export condition and legacy entries, with blank member/tag separation under the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This parsed JSON subset defines package metadata fields, not native path/process operations; resolver functions own path interpretation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type executes no algorithm; manifest discovery and target selection own their costs.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This data shape defines no reusable-answer identity or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Parsed JSON fields acquire no resource or retained population; their caller owns the record.
   */
  export type PackageManifest = {
    /** Runtime dependencies; scanned for packages that declare plugins. */
    dependencies?: Record<string, unknown>;

    /** Development dependencies; scanned the same way. */
    devDependencies?: Record<string, unknown>;

    /** The export map, including an optional `ttsc` condition. */
    exports?: unknown;

    /** Legacy CommonJS entry. */
    main?: unknown;

    /** Legacy ES module entry. */
    module?: unknown;

    /** Package name. */
    name?: unknown;

    /** Ttsc's own manifest block, declaring the package's plugins. */
    ttsc?: unknown;
  };

  /**
   * Whether `file` exists and is a regular file, following links.
   *
   * @evidence contracts/common.md#principled-implementation stat follows links and isFile rejects directories; unavailable metadata returns false for discovery rather than treating any existing path as a manifest.
   * @evidence contracts/common.md#clear-and-simple-design A single predicate gives manifest and export-target discovery the same regular-file requirement.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Regular-file kind comes from filesystem metadata rather than suffix guessing or a known-package exception.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states both regular-file and link-following semantics, with separate acknowledgment prose under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native stat provides actual file kind through OS-neutral Node APIs; no platform path spelling assumption determines presence.
   * @evidence contracts/performance.md#efficient-algorithms One native metadata query avoids reading file contents for kind; path lookup/link traversal and path-text costs remain delegated rather than bounded by the query count.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Presence must be observed now; this predicate owns no metadata cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The synchronous query retains no handle or population.
   */
  export function existingFile(file: string): boolean {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  }

  /**
   * The names of the project's direct dependencies and dev dependencies, each
   * once, in manifest order. Only these are scanned for automatic plugins.
   *
   * @evidence contracts/common.md#principled-implementation Dependency and devDependency object keys define the direct discovery population; a Set preserves first occurrence and prevents duplicate automatic entries.
   * @evidence contracts/common.md#clear-and-simple-design The operation extracts names only, leaving package presence and plugin marker interpretation to the resolver.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No package allowlist or transitive dependency scan substitutes for declared direct dependencies.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states ordered deduplication and direct-only scope, with separated tags under the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This pure manifest-key extraction does not interpret native paths or process behavior.
   *
   * @evidence contracts/performance.md#efficient-algorithms Enumeration of the two accepted object key populations preserves first occurrence with a Set. Key/name bytes, property enumeration and hashing accompany key count; temporary key arrays and returned unique names coexist, so output storage is not measured by name count alone.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The Set deduplicates this result but establishes no retained expensive-work cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The local Set and returned array belong to the call; no persistent population is kept.
   */
  export function directDependencyNames(manifest: PackageManifest): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const dependencies of [
      manifest.dependencies,
      manifest.devDependencies,
    ]) {
      if (!isRecord(dependencies)) {
        continue;
      }
      for (const name of Object.keys(dependencies)) {
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);
        out.push(name);
      }
    }
    return out;
  }

  /**
   * The selected `package.json` of dependency `name` as seen from the project:
   * the project's own `node_modules/<name>` first, then Node resolution of
   * `<name>/package.json`, then, for a package whose exports hide its manifest,
   * the manifest of the package directory Node resolved the package's entry
   * in.
   *
   * That directory is the `node_modules/<name>` of the first search root that
   * selects the entry (`moduleResolutionBaseSelects`), the rule every
   * resolution input of a load stops at. The manifest nearest the entry is not
   * it: a dual package keeps `dist/cjs/package.json` beside its CommonJS build,
   * and reading that one would miss the package's own `ttsc` declaration.
   * Realpath is best effort: a failed canonicalization retains the selected
   * native spelling rather than certifying physical identity.
   *
   * @evidence contracts/common.md#principled-implementation Direct manifest lookup precedes Node manifest resolution and selected-entry search-root ownership, so exports-hidden manifests and nested dual-build package.json files do not change package owner identity.
   * @evidence contracts/common.md#clear-and-simple-design The ordered resolver returns one selected manifest with best-effort realpath, while shared helpers handle regular files and selected-root matching.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback addresses packages whose export map hides metadata; it does not guess ownership from an entry's nearest nested manifest or special-case a package name.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains the three ordered paths and why selected package root differs from nearest manifest, with paragraph/tag separation under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native joins/dirname/realpath and createRequire resolve use actual OS-neutral package paths; package-name slash components follow specifier grammar.
   * @evidence contracts/performance.md#efficient-algorithms A direct hit still includes path/name construction, native stat and best-effort realpath. Fallback adds Node manifest/entry resolution and search-root candidate/native identity checks until selection; query counts, complete path/name text and native topology contribute work even when no farther root is visited.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current owning-manifest resolution is not cached here; accepted descriptor answers reuse its separately proved input observations.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The query returns a caller-owned path and retains no native handle or cross-call population.
   */
  export function resolveDependencyPackageJson(
    name: string,
    projectRoot: string,
  ): string | undefined {
    const direct = path.join(projectRoot, "node_modules", ...name.split("/"));
    const directManifest = path.join(direct, "package.json");
    if (existingFile(directManifest)) {
      return resolveRealPath(directManifest);
    }
    const projectPackage = path.join(projectRoot, "package.json");
    const projectRequire = createRequire(projectPackage);
    try {
      return resolveRealPath(projectRequire.resolve(`${name}/package.json`));
    } catch {
      let entry: string;
      try {
        entry = projectRequire.resolve(name);
      } catch {
        return undefined;
      }
      for (const searchPath of projectRequire.resolve.paths(name) ?? []) {
        const directory = path.join(searchPath, ...name.split("/"));
        if (!moduleResolutionBaseSelects(directory, entry, [])) continue;
        const manifest = path.join(directory, "package.json");
        return existingFile(manifest) ? resolveRealPath(manifest) : undefined;
      }
      return undefined;
    }
  }

  /**
   * Select the nearest regular `package.json` at or above `location`, using its
   * realpath when available and retaining the selected spelling on failure.
   * Candidate enumeration and file-kind rechecks are separate observations;
   * this query does not freeze package scope or certify unresolved identity.
   *
   * @evidence contracts/common.md#principled-implementation Ancestor candidates are rechecked for the first regular manifest, then best-effort canonicalization returns realpath or selected lexical spelling. This current scope observation is not a frozen physical-identity proof.
   * @evidence contracts/common.md#clear-and-simple-design Candidate enumeration and physical resolution stay in shared helpers while this adapter selects the nearest file.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Scope is derived from ancestor candidates, not a known-package path or manifest-shaped directory.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states nearest scope, separate observations and realpath fallback, with separate tags under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native dirname/resolve/realpath provide OS-neutral ancestor and link semantics without manual slash splitting.
   * @evidence contracts/performance.md#efficient-algorithms Candidate enumeration performs native start/ancestor queries and stores complete path strings; find then rechecks candidate file kinds before best-effort realpath. Native path/link lookup and path-text cost accompany depth, and the selection pass repeats metadata queries rather than reusing their earlier observations.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This fresh scope query owns no retained discovery cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Candidate arrays and the returned path are call-owned with no open resource retained.
   */
  export function findNearestPackageJson(location: string): string | undefined {
    const selected =
      collectNearestPackageJsonCandidates(location).find(existingFile);
    return selected === undefined ? undefined : resolveRealPath(selected);
  }

  /**
   * Every package-scope candidate through the first regular manifest file.
   *
   * The starting location must exist so its file/directory kind can be read.
   *
   * @evidence contracts/common.md#principled-implementation Start-kind selection and native parent traversal collect missing nearer candidates through the first actual manifest; parent equality terminates at the filesystem root.
   * @evidence contracts/common.md#clear-and-simple-design This operation enumerates scope inputs independently of canonicalizing the selected manifest, preserving missing candidate spellings for invalidation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts It stops at the actual nearest regular manifest, without assuming a fixed workspace depth or adding every farther ancestor as a workaround.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states candidate bounds and the existing-start-path requirement, with separate tag prose following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native stat/resolve/dirname provide OS-neutral starting kind and root termination, including Windows volume roots.
   * @evidence contracts/performance.md#efficient-algorithms The initial kind stat and one manifest-kind query per ancestor accompany native path resolve/dirname work. Candidate storage includes complete path strings at each visited depth; native lookup/link topology and path-text processing are not bounded by ancestor count alone.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current ancestor candidates are observed per query rather than cached.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned candidate array is caller-owned and no handle or global population is retained.
   */
  export function collectNearestPackageJsonCandidates(
    location: string,
  ): string[] {
    let current = fs.statSync(location).isDirectory()
      ? location
      : path.dirname(location);
    const candidates: string[] = [];
    while (true) {
      const manifest = path.resolve(current, "package.json");
      candidates.push(manifest);
      if (existingFile(manifest)) return candidates;
      const parent = path.dirname(current);
      if (parent === current) return candidates;
      current = parent;
    }
  }

  /**
   * Read a package manifest, or `undefined` when the file is absent or is not a
   * JSON object. A malformed manifest throws naming the file: these are usually
   * files the user did not author, which makes an unattributed `JSON.parse`
   * message worse here than anywhere else.
   *
   * @evidence contracts/common.md#principled-implementation Only a regular file containing non-null, non-array JSON object data is a manifest; malformed syntax retains the file-attributed parser error instead of becoming absence.
   * @evidence contracts/common.md#clear-and-simple-design File-kind checking and attributed JSON reading are delegated, then this boundary validates the manifest container shape.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Arrays and primitive JSON are not promoted to package records by a type cast; parser errors are not suppressed to fabricate missing configuration.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc distinguishes missing/non-object results from attributed malformed-JSON errors, with paragraph/tag separation under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native file queries and the shared JSON reader interpret actual filesystem paths without POSIX-only parsing or shell invocation.
   * @evidence contracts/performance.md#efficient-algorithms Native regular-file preflight precedes the shared full UTF-8 read, optional BOM normalization and strict JSON parse. Path/metadata lookup, decode, text/value allocation and parse-error attribution accompany manifest bytes; no dependency traversal or duplicate JSON parse is added.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current manifest content is read per operation; no manifest-answer cache is owned here.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous reads close their descriptors and the parsed record belongs to the caller.
   */
  export function readPackageManifest(
    file: string,
  ): PackageManifest | undefined {
    if (!existingFile(file)) {
      return undefined;
    }
    const parsed = readJsonFile(file);
    return isRecord(parsed) && !Array.isArray(parsed)
      ? (parsed as PackageManifest)
      : undefined;
  }

  /**
   * Whether a parsed JSON value is an object (arrays included).
   *
   * @evidence contracts/common.md#principled-implementation The JavaScript typeof/non-null predicate recognizes object containers only; callers that require maps separately reject arrays.
   * @evidence contracts/common.md#clear-and-simple-design One shallow guard supports export arrays and records without pretending to validate their fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate asserts only object access, not a known descriptor shape or valid cache proof.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explicitly includes arrays so callers know the guard's limit; separate tags follow the documentation skill.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This pure JavaScript object-kind guard has no path, process or OS boundary.
   *
   * @evidence contracts/performance.md#efficient-algorithms Two constant-time checks inspect no child population.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The shallow predicate has no reusable computation identity or cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It returns a boolean and retains no resource or population.
   */
  export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  /**
   * Resolve a plugin specifier from the project root, using realpath when
   * available and retaining selected native spelling on canonicalization
   * failure.
   *
   * Absolute and relative specifiers are paths. A package specifier honors the
   * package's `ttsc` export condition first, so a package whose main entry is a
   * runtime barrel can point plugin loading at a runtime-free descriptor, and
   * otherwise resolves as Node would.
   *
   * @evidence contracts/common.md#principled-implementation Native absolute/relative inputs use their explicit base; bare packages opt into ttsc target semantics only when a matching branch exists, otherwise Node owns resolution.
   * @evidence contracts/common.md#clear-and-simple-design One dispatcher keeps plugin-only conditions local and returns best-effort canonical selection to descriptor loading; unsuccessful realpath is not physical-identity proof.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Dedicated condition selection is a declared package extension, not process-wide patching; opted-in invalid targets fail without falling back to unrelated runtime exports.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains path versus package behavior and condition scope; helper comments explain error/null semantics and target constraints, with separated prose under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Native path classification/resolution and best-effort realpath preserve caller bases. Package target URL resolution uses a native pathToFileURL anchor and fileURLToPath decoding before native containment/file checks; URL/export grammar is not interpreted as literal native percent spelling.
   * @evidence contracts/performance.md#efficient-algorithms Path cases still perform native normalization/realpath; package cases include manifest discovery/read/parse and Node queries. Export selection classifies keys, compares patterns and may recursively substitute/inspect target nodes before short-circuit target resolution. Key/target/path/manifest bytes and native operations contribute cost; no target depth or size ceiling is supplied here.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Resolution reads current package authority and keeps no cross-call answer cache; observed-input cache owners decide reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources All target and candidate structures are call-local and no process or descriptor handle is acquired.
   */
  export function resolvePluginRequest(
    specifier: string,
    projectRoot: string,
  ): string {
    if (path.isAbsolute(specifier)) {
      return resolveRealPath(specifier);
    }
    if (isRelativePluginSpecifier(specifier)) {
      return resolveRealPath(path.resolve(projectRoot, specifier));
    }
    // A package whose main `.` entry is a runtime barrel cannot double as a
    // plugin descriptor entry: loading it during plugin bootstrap drags the
    // runtime in (and, for a self-hosting transform like typia, deadlocks —
    // loading the transform would have to build the runtime the transform
    // emits). Such a package opts in with a `ttsc` export condition that points
    // at a runtime-free descriptor; honour it here, scoped to plugin resolution.
    const conditioned = resolvePluginExportCondition(specifier, projectRoot);
    if (conditioned !== null) {
      return conditioned;
    }
    return resolveRealPath(
      require.resolve(specifier, { paths: [projectRoot] }),
    );
  }

  /**
   * Condition names ttsc activates when resolving a plugin entry's package
   * `exports`.
   */
  const PLUGIN_EXPORT_CONDITIONS: readonly string[] = [
    "ttsc",
    "node",
    "require",
    "default",
  ];

  /**
   * Resolve a bare plugin specifier under the dedicated `ttsc` export
   * condition.
   *
   * A package whose `.` entry is a runtime barrel (e.g. `typia`, whose index
   * re-exports the whole validator runtime) cannot serve as the plugin
   * descriptor entry: loading it during plugin bootstrap pulls the runtime in
   * and, for a self-hosting transform, forms a cycle. Such a package opts in by
   * adding a `ttsc` condition to its `exports` that points at a runtime-free
   * descriptor:
   *
   * "exports": { ".": { "ttsc": "./lib/transform.js", "default":
   * "./lib/index.js" } }
   *
   * The condition is honoured ONLY here, scoped to plugin-entry resolution. A
   * process-wide `--conditions=ttsc` would also redirect the package's normal
   * `import`s to the descriptor and break its runtime, so it must not be used.
   *
   * Returns `null` to fall back to the normal `require.resolve` when the
   * package does not opt in — no `exports`, or no `ttsc` branch for the
   * requested subpath — so such a package resolves as an ordinary package. A
   * package that opts in gets Node's answer for its target: the file it
   * selects, or the rejection Node would report for it.
   */
  function resolvePluginExportCondition(
    specifier: string,
    baseDir: string,
  ): string | null {
    const split = splitPackageSpecifier(specifier);
    if (split === null) {
      return null;
    }
    const packageJson = resolveDependencyPackageJson(
      split.packageName,
      baseDir,
    );
    if (packageJson === undefined) {
      return null;
    }
    const exportsField = readPackageManifest(packageJson)?.exports;
    if (exportsField === undefined) {
      return null;
    }
    const target = selectExportTarget(exportsField, split.subpath, packageJson);
    // Only take over when the package actually opts in with a `ttsc` condition
    // for this subpath; otherwise defer so behaviour is unchanged for every
    // package that does not.
    if (target === undefined || !containsCondition(target, "ttsc")) {
      return null;
    }
    // From here the package has opted in, so Node's rules for the selected
    // target decide, and nothing falls back to the ordinary runtime entry: a
    // blocked (`null`) or unmatched target is not exported, an invalid target
    // is refused, and a selected file that is missing is not found. Falling
    // back would load the runtime barrel the package kept away from plugin
    // bootstrap, or a file Node itself would never resolve.
    const packageDir = path.dirname(packageJson);
    const file = resolvePackageTarget(
      target,
      new Set(PLUGIN_EXPORT_CONDITIONS),
      packageDir,
      packageJson,
    );
    if (file === null || file === undefined) {
      throw packageResolutionError(
        "ERR_PACKAGE_PATH_NOT_EXPORTED",
        `ttsc: package subpath "${split.subpath}" is not exported for plugin resolution by ${packageJson}`,
      );
    }
    if (!existingFile(file)) {
      throw packageResolutionError(
        "MODULE_NOT_FOUND",
        `ttsc: cannot find module ${file}, the plugin entry selected for "${specifier}" by ${packageJson}`,
      );
    }
    return resolveRealPath(file);
  }

  /**
   * Split a bare specifier into its package name and the `.`-prefixed subpath
   * it addresses (`"typia"` → `.`, `"typia/lib/transform"` → `./lib/transform`,
   * `"@scope/pkg/sub"` → `./sub`). Returns `null` for a relative/empty
   * specifier or a scoped name lacking two slash-separated components. This
   * split is not a complete package-name validity check.
   */
  function splitPackageSpecifier(
    specifier: string,
  ): { packageName: string; subpath: string } | null {
    if (specifier.length === 0 || specifier.startsWith(".")) {
      return null;
    }
    const segments = specifier.split("/");
    const nameSegments = specifier.startsWith("@") ? 2 : 1;
    if (segments.length < nameSegments) {
      return null;
    }
    const rest = segments.slice(nameSegments).join("/");
    return {
      packageName: segments.slice(0, nameSegments).join("/"),
      subpath: rest.length === 0 ? "." : `./${rest}`,
    };
  }

  /**
   * The `exports` entry addressing `subpath`, applying Node's rule that an
   * `exports` value with no `.`-prefixed keys is sugar for the `.` target.
   * Returns `undefined` when no entry addresses the subpath.
   */
  function selectExportTarget(
    exportsField: unknown,
    subpath: string,
    packageJson: string,
  ): unknown {
    if (typeof exportsField === "string" || Array.isArray(exportsField)) {
      return subpath === "." ? exportsField : undefined;
    }
    if (typeof exportsField !== "object" || exportsField === null) {
      return undefined;
    }
    const record = exportsField as Record<string, unknown>;
    const keys = Object.keys(record);
    const isSubpathMap = keys.some((key) => key.startsWith("."));
    if (isSubpathMap && keys.some((key) => !key.startsWith("."))) {
      throw packageResolutionError(
        "ERR_INVALID_PACKAGE_CONFIG",
        `ttsc: "exports" in ${packageJson} cannot mix subpath and condition keys`,
      );
    }
    if (!isSubpathMap) {
      // Conditions object: the whole value is the `.` target.
      return subpath === "." ? exportsField : undefined;
    }
    if (
      Object.prototype.hasOwnProperty.call(record, subpath) &&
      !subpath.includes("*") &&
      !subpath.endsWith("/")
    ) {
      return record[subpath];
    }
    let pattern: string | undefined;
    let replacement: string | undefined;
    for (const key of keys) {
      const candidate = exportPatternReplacement(key, subpath);
      if (
        candidate !== undefined &&
        (pattern === undefined || compareExportPatternKeys(key, pattern) < 0)
      ) {
        pattern = key;
        replacement = candidate;
      }
    }
    if (pattern === undefined) {
      return undefined;
    }
    return substituteExportTarget(record[pattern], replacement!);
  }

  /** Capture the middle of one valid single-star exports key. */
  function exportPatternReplacement(
    pattern: string,
    subpath: string,
  ): string | undefined {
    const star = pattern.indexOf("*");
    if (
      !pattern.startsWith("./") ||
      star === -1 ||
      pattern.indexOf("*", star + 1) !== -1
    ) {
      return undefined;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (
      subpath.length < pattern.length ||
      !subpath.startsWith(prefix) ||
      !subpath.endsWith(suffix)
    ) {
      return undefined;
    }
    return subpath.slice(prefix.length, subpath.length - suffix.length);
  }

  /** Node exports patterns rank longer prefixes, then longer full keys, first. */
  function compareExportPatternKeys(left: string, right: string): number {
    const leftPrefix = left.indexOf("*");
    const rightPrefix = right.indexOf("*");
    if (leftPrefix !== rightPrefix) {
      return rightPrefix - leftPrefix;
    }
    return right.length - left.length;
  }

  /** Substitute the selected pattern capture into every string target branch. */
  function substituteExportTarget(
    target: unknown,
    replacement: string,
  ): unknown {
    if (typeof target === "string") {
      return target.split("*").join(replacement);
    }
    if (Array.isArray(target)) {
      return target.map((entry) => substituteExportTarget(entry, replacement));
    }
    if (typeof target !== "object" || target === null) {
      return target;
    }
    return Object.fromEntries(
      Object.entries(target).map(([condition, value]) => [
        condition,
        substituteExportTarget(value, replacement),
      ]),
    );
  }

  /** True when condition key `condition` appears anywhere in a (nested) target. */
  function containsCondition(target: unknown, condition: string): boolean {
    if (Array.isArray(target)) {
      return target.some((entry) => containsCondition(entry, condition));
    }
    if (typeof target !== "object" || target === null) {
      return false;
    }
    return Object.entries(target).some(
      ([key, value]) =>
        key === condition || containsCondition(value, condition),
    );
  }

  /**
   * Node's `PACKAGE_TARGET_RESOLVE` for an `exports` target whose pattern is
   * already substituted: the absolute file it selects, `null` when a matched
   * branch blocks it, or `undefined` when no branch matches.
   *
   * A string must be a `./` URL target whose segments name no `.`, `..`, or
   * `node_modules`, and must stay inside the package after URL resolution and
   * native filename decoding; anything else is an invalid target. An object
   * tries its keys in package order and returns the first branch that matches,
   * so a matched `null` ends the search instead of falling through to
   * `default`. An array returns its first matching entry, passing over entries
   * that are invalid or `null`, and ends with the last of those outcomes.
   */
  function resolvePackageTarget(
    target: unknown,
    conditions: ReadonlySet<string>,
    packageDir: string,
    packageJson: string,
  ): string | null | undefined {
    if (typeof target === "string") {
      if (
        !target.startsWith("./") ||
        INVALID_TARGET_SEGMENT.test(target.slice(2))
      ) {
        throw invalidPackageTarget(target, packageJson);
      }
      const file = fileURLToPath(new URL(target, pathToFileURL(packageJson)));
      if (isOutsideDirectory(packageDir, file)) {
        throw invalidPackageTarget(target, packageJson);
      }
      return file;
    }
    if (Array.isArray(target)) {
      if (target.length === 0) return null;
      let last: { error: unknown } | null | undefined;
      for (const entry of target) {
        let resolved: string | null | undefined;
        try {
          resolved = resolvePackageTarget(
            entry,
            conditions,
            packageDir,
            packageJson,
          );
        } catch (error) {
          if (!isInvalidPackageTarget(error)) throw error;
          last = { error };
          continue;
        }
        if (resolved === undefined) continue;
        if (resolved === null) {
          last = null;
          continue;
        }
        return resolved;
      }
      if (last === undefined || last === null) return last;
      throw last.error;
    }
    if (target === null) return null;
    if (typeof target === "object") {
      const entries = Object.entries(target as Record<string, unknown>);
      if (
        entries.some(([key]) => {
          const numeric = Number(key);
          return (
            String(numeric) === key && numeric >= 0 && numeric < 0xffffffff
          );
        })
      ) {
        throw packageResolutionError(
          "ERR_INVALID_PACKAGE_CONFIG",
          `ttsc: "exports" in ${packageJson} cannot contain numeric condition keys`,
        );
      }
      for (const [key, value] of entries) {
        if (key !== "default" && !conditions.has(key)) continue;
        const resolved = resolvePackageTarget(
          value,
          conditions,
          packageDir,
          packageJson,
        );
        if (resolved !== undefined) return resolved;
      }
      return undefined;
    }
    throw invalidPackageTarget(String(target), packageJson);
  }

  /**
   * A path segment an `exports` target may not name: `.`, `..`, or
   * `node_modules`, each also percent-encoded, as Node's resolver rejects
   * them.
   */
  const INVALID_TARGET_SEGMENT =
    /(^|\\|\/)((\.|%2e)(\.|%2e)?|(n|%6e|%4e)(o|%6f|%4f)(d|%64|%44)(e|%65|%45)(_|%5f)(m|%6d|%4d)(o|%6f|%4f)(d|%64|%44)(u|%75|%55)(l|%6c|%4c)(e|%65|%45)(s|%73|%53))(\\|\/|$)/i;

  function isOutsideDirectory(directory: string, file: string): boolean {
    const relative = path.relative(directory, file);
    return (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    );
  }

  function invalidPackageTarget(target: string, packageJson: string): Error {
    return packageResolutionError(
      "ERR_INVALID_PACKAGE_TARGET",
      `ttsc: invalid "exports" target ${JSON.stringify(target)} for plugin resolution in ${packageJson}`,
    );
  }

  function isInvalidPackageTarget(error: unknown): boolean {
    return (
      (error as { code?: unknown } | null)?.code ===
      "ERR_INVALID_PACKAGE_TARGET"
    );
  }

  /** An error carrying the code Node's resolver reports for the same case. */
  function packageResolutionError(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
  }

  /**
   * `location` through its symlinks, or unchanged when it does not resolve.
   *
   * @evidence contracts/common.md#principled-implementation Successful realpath yields physical selection; failure retains the original spelling for the owning resolver/load error rather than claiming it is physically proven.
   * @evidence contracts/common.md#clear-and-simple-design This best-effort selection helper is distinct from nullable proof observation, because loading still needs an unresolved path to diagnose.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback preserves input data and does not fabricate a target or a cache-valid physical identity.
   * @evidence contracts/common.md#meaningful-documentation Native JSDoc states link resolution and unchanged-on-failure behavior, with separate tags following the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation Node native realpath resolves actual links and Windows short-name aliases without separator parsing or blanket case folding. The resulting descriptor request and factory coordinates name the same physical module.
   * @evidence contracts/performance.md#efficient-algorithms One Node realpath request avoids file-content reads; delegated component/link resolution and returned path text depend on native path/topology rather than a constant-time request count.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Targets are observed now; no canonical-path cache is owned here.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned string is caller-owned and no open resource or population remains.
   */
  export function resolveRealPath(location: string): string {
    try {
      return fs.realpathSync.native(location);
    } catch {
      return location;
    }
  }
}
