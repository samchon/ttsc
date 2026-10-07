import fs from "node:fs";
import path from "node:path";

import type { OwningModuleOptions } from "./OwningModuleOptions";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * The runtime's module format (ES module or CommonJS) for a TypeScript file.
 * For supported checked-project settings, classification follows the pinned
 * TypeScript-Go emit precedence; unowned sources use this runtime's nearest
 * package-scope policy, not a full Node loader validation or syntax detector.
 *
 * The runtime serves compiled JavaScript under the `.ts` URL, and Node must be
 * told the format of that JavaScript. Guessing from the text would disagree
 * with the emit whenever a file's syntax and its configuration differ, so the
 * answer comes from the extension, the owning project's options, and the
 * package `type`, in the supported emit order. Unreadable or malformed present
 * manifests use CommonJS/no-declaration here rather than reporting a package
 * parse error; cached scope observations are not invalidated by later
 * mutation.
 *
 * @evidence contracts/common.md#principled-implementation Extension, dependency package declaration and effective module/target determine supported checked-emit format in pinned upstream order; unowned sources use the runtime's nearest-scope CommonJS fallback policy without claiming full Node loader equivalence.
 * @evidence contracts/common.md#clear-and-simple-design One classifier owns format policy with private option normalization and package-scope lookup helpers, keeping hooks from independently guessing authored syntax.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Documented compiler precedence replaces source-text sniffing; node_modules is the upstream package-metadata boundary rather than a hardcoded consumer exception.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain supported emit precedence, unowned-source and malformed-manifest policy, package override scope and cache invalidation limits.
 * @evidence contracts/portability.md#os-neutral-implementation Native path.dirname/fs select package scopes; node_modules matching is upstream's exact protocol segment rather than a guessed filesystem case policy.
 * @evidence contracts/performance.md#efficient-algorithms Classification processes filename/option text; uncached scope lookup walks ancestor paths with native stat/read and uncapped JSON-byte costs, then fills visited directory keys. Cached scope map access avoids new native reads but still processes path keys; no fixed wrapper count bounds native latency.
 * @evidence contracts/performance.md#reuse-equivalent-work This module instance shares its first scope observation across default and explicit-declaration decisions. No watcher or invalidation revisits a changed manifest, so reuse relies on the caller's stable package-scope premise rather than tracking Node's independent loader state.
 * @evidence contracts/performance.md#bound-retention-and-release-resources packageTypeCache retains directory-key text and shared scope answers without eviction while this module instance remains reachable, growing with observed scopes. Native reads retain no descriptor, and this cache does not own loaded modules or their release.
 */
export namespace RuntimeModuleFormat {
  /**
   * Classify supported checked emit from configuration and package scope, never
   * by sniffing emitted text or validating the full Node loader contract.
   *
   * The file extension is authoritative first (`.mts`/`.mjs` → module,
   * `.cts`/`.cjs` → commonjs): tsgo records these in
   * `GetImpliedNodeFormatForFile`, then its emit worker consumes that metadata
   * or preserves the explicit extension for non-node module kinds.
   *
   * After that the decision belongs to the project that emitted the file, so
   * `options` is the whole compiler-option pair tsgo consults, not just
   * `module`: an absent `module` is NOT "ask Node", it is "derive the kind from
   * `target`" (tsgo's `getEmitModuleKind`), and TypeScript 7 defaults `target`
   * to the latest standard, which means ES modules. A source-shipping
   * dependency under `node_modules` can override this with an explicit package
   * `type` for every module kind. Otherwise only the `node*` family defers to
   * the nearest package `type`.
   *
   * `options` is `null` when the caller has no recorded checked preparation for
   * the file, as in the orphan-source lane. The runtime's package-scope policy
   * applies: supported `type` decides, otherwise CommonJS is returned,
   * including a present unreadable/malformed manifest.
   *
   * @evidence contracts/common.md#principled-implementation Authoritative extension wins, then a node_modules package's explicit declaration, then the owning compiler's effective kind and node-family scope rule; this preserves the format of checked emit instead of treating absent module as an unowned file.
   * @evidence contracts/common.md#clear-and-simple-design The ordered classifier delegates package lookup and option defaulting to focused private helpers while keeping precedence visible in one function.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No source sniffing or project-specific exception supplies a format; package overrides are constrained by the actual upstream source metadata boundary.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain supported extension/options precedence, dependency overrides and null ownership, including the runtime's CommonJS malformed-manifest fallback rather than certifying all Node loader behavior.
   * @evidence contracts/portability.md#os-neutral-implementation Native ancestor traversal locates manifests; exact extension and node_modules protocol spelling are distinguished from filesystem case sensitivity.
   * @evidence contracts/performance.md#efficient-algorithms Filename suffix/segment and option normalization process their text; at most one uncached ancestor scope walk adds native stat/read, manifest bytes and visited path-key storage. Both scope questions share the map answer, avoiding repeat native reads without making path work or latency constant.
   * @evidence contracts/performance.md#reuse-equivalent-work Explicit-declaration and default consumers share the instance's first nearest-scope observation under stable package metadata; later filesystem mutation does not invalidate that answer, and owning project options still classify independently.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Native reads leave no retained handle; the namespace retains observed directory keys and scope answers without eviction while its instance remains reachable. Per-walk ancestor chains and decoded manifest data are temporary; this operation does not own emitted artifact storage.
   */
  export function moduleFormat(
    filename: string,
    options: OwningModuleOptions | null,
  ): string {
    if (filename.endsWith(".mts") || filename.endsWith(".mjs")) {
      return "module";
    }
    if (filename.endsWith(".cts") || filename.endsWith(".cjs")) {
      return "commonjs";
    }
    if (options === null) {
      return nearestPackageType(filename);
    }
    // A package that states its `type` outright decides for the files inside it
    // whatever the module kind is. This is where a source-shipping dependency's
    // own declaration overrides the compiling project's `module`; see
    // `declaredNodeModulesPackageType` for why `node_modules` bounds it.
    const declared = declaredNodeModulesPackageType(filename);
    if (declared !== null) {
      return declared;
    }
    const kind = effectiveModuleKind(options);
    if (
      kind === "node16" ||
      kind === "node18" ||
      kind === "node20" ||
      kind === "nodenext"
    ) {
      return nearestPackageType(filename);
    }
    if (kind === "commonjs") {
      return "commonjs";
    }
    // Everything that remains (es2015 … esnext, and `preserve`, which keeps the
    // authored ESM syntax verbatim) classifies as ECMAScript modules for
    // supported project settings. This helper does not validate unsupported
    // module values or certify that such a project reached successful emit.
    return "module";
  }

  /**
   * The `"type"` a `node_modules` package states for `filename`, or `null`.
   *
   * Tsgo's `GetImpliedNodeFormatForEmitWorker` consults a file's
   * `packageJsonType` for **every** module kind, not just the `node*` family.
   * So a source-shipping dependency that declares `"type": "commonjs"` is
   * emitted as CommonJS even while the compiling project asks for `esnext`, and
   * the mirror has to honour the same override or Node is handed the wrong
   * format.
   *
   * Outside `node_modules` that field is empty for every module kind this
   * override can change. `loadSourceFileMetaData` does fill it elsewhere — for
   * a file whose extension does not itself state the format (anything but
   * `.mts`, `.cts`, `.mjs`, `.cjs`) whose project sets `moduleResolution` to
   * the `node16`…`nodenext` family — but `program.go` rejects that resolution
   * unless `module` is in the same family, and for a `node*` `module` the
   * package `type` is already the whole answer, which the caller's own `node*`
   * branch produces. So answering from a manifest outside `node_modules` could
   * only override the project's own `module` option, the very confusion this
   * classifier exists to end.
   */
  function declaredNodeModulesPackageType(
    filename: string,
  ): "module" | "commonjs" | null {
    if (!pathHasNodeModulesSegment(filename)) {
      return null;
    }
    return declaredPackageType(filename);
  }

  /**
   * Whether any path segment of `filename` is literally `node_modules`.
   *
   * Case-sensitive on every platform, because the upstream test this mirrors is
   * a case-sensitive substring search and Node's own resolver recognises only
   * the exact spelling. A directory named `Node_Modules` is a package store to
   * neither of them, and must not become one here.
   */
  function pathHasNodeModulesSegment(filename: string): boolean {
    return filename.split(/[\\/]/).includes("node_modules");
  }

  /**
   * The `module` kind tsgo actually emits with, mirroring `getEmitModuleKind`:
   * the declared `module` when there is one, and otherwise the kind implied by
   * `target`. `"none"` is the spelling of an unset `module`, so it derives the
   * same way.
   */
  function effectiveModuleKind(options: OwningModuleOptions): string {
    const declared = (options.module ?? "").toLowerCase();
    if (declared !== "" && declared !== "none") {
      return declared;
    }
    const target = (options.target ?? "").toLowerCase();
    if (target === "esnext") {
      return "esnext";
    }
    const year = scriptTargetYear(target);
    if (year === null) {
      // An unset `target` is `ScriptTargetLatestStandard` upstream, well above the
      // ES2022 boundary. Every other spelling lands here too: TypeScript 7 removed
      // `ES5` and dropped `ES3` entirely, and its only remaining targets are
      // year-numbered ones, so nothing that reaches emit derives CommonJS.
      return "es2022";
    }
    if (year >= 2022) return "es2022";
    if (year >= 2020) return "es2020";
    return "es2015";
  }

  /**
   * Year of an `ES<year>` script target, with `es6` normalized to its `es2015`
   * synonym. Returns `null` when the spelling is not a year-numbered target,
   * which the caller resolves to the modern default.
   */
  function scriptTargetYear(target: string): number | null {
    if (target === "es6") {
      return 2015;
    }
    const match = /^es(\d{4})$/.exec(target);
    return match === null ? null : Number(match[1]);
  }

  /**
   * One nearest package-scope observation for both format decisions. Values
   * remain cached within this module instance without filesystem invalidation.
   */
  interface PackageScope {
    /** Node's format when this scope owns an otherwise unclassified file. */
    nodeType: "module" | "commonjs";

    /** Explicit supported type declaration, or absence/invalidity. */
    declaredType: "module" | "commonjs" | null;
  }

  const packageTypeCache = new Map<string, PackageScope>();

  function nearestPackageType(filename: string): "module" | "commonjs" {
    return packageScope(filename).nodeType;
  }

  function packageScope(filename: string): PackageScope {
    let directory = path.dirname(filename);
    const chain: string[] = [];
    while (true) {
      const cached = packageTypeCache.get(directory);
      if (cached !== undefined) {
        return rememberPackageType(chain, cached);
      }
      chain.push(directory);
      const scope = readPackageType(directory);
      if (scope !== null) {
        return rememberPackageType(chain, scope);
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return rememberPackageType(chain, {
          nodeType: "commonjs",
          declaredType: null,
        });
      }
      directory = parent;
    }
  }

  function rememberPackageType(
    directories: readonly string[],
    scope: PackageScope,
  ): PackageScope {
    for (const directory of directories) {
      packageTypeCache.set(directory, scope);
    }
    return scope;
  }

  /** Read a present package scope; null means no regular manifest was found. */
  function readPackageType(directory: string): PackageScope | null {
    const manifestPath = path.join(directory, "package.json");
    if (!RuntimeFilesystem.isFile(manifestPath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        type?: unknown;
      };
      const declaredType =
        parsed.type === "module" || parsed.type === "commonjs"
          ? parsed.type
          : null;
      return {
        nodeType: declaredType ?? "commonjs",
        declaredType,
      };
    } catch {
      return { nodeType: "commonjs", declaredType: null };
    }
  }

  /**
   * The `"type"` the nearest `package.json` states outright, or `null` when the
   * nearest manifest omits it (or there is none).
   *
   * `nearestPackageType` applies the runtime's CommonJS default to a silent or
   * unreadable/malformed manifest. This answers the narrower question "did a
   * package actually say", which is what an override has to be built on: a
   * manifest that says nothing must not out-vote the compiling project's own
   * `module` option.
   */
  function declaredPackageType(filename: string): "module" | "commonjs" | null {
    return packageScope(filename).declaredType;
  }
}
