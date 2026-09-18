import fs from "node:fs";
import path from "node:path";

import type { OwningModuleOptions } from "./OwningModuleOptions";
import { RuntimeFilesystem } from "./RuntimeFilesystem";

/**
 * The module format (ES module or CommonJS) of a TypeScript file, decided the
 * way TypeScript-Go decided it when it emitted the file.
 *
 * The runtime serves compiled JavaScript under the `.ts` URL, and Node must be
 * told the format of that JavaScript. Guessing from the text would disagree
 * with the emit whenever a file's syntax and its configuration differ, so the
 * answer comes from the extension, the owning project's options, and the
 * package `type`, in tsgo's own order.
 */
export namespace RuntimeModuleFormat {
  /**
   * Decide the module format the way Node and tsgo do — from configuration,
   * never by sniffing the emitted text.
   *
   * The file extension is authoritative first (`.mts`/`.mjs` → module,
   * `.cts`/`.cjs` → commonjs), exactly as tsgo's
   * `getImpliedNodeFormatForEmitWorker` checks it ahead of everything else.
   *
   * After that the decision belongs to the project that emitted the file, so
   * `options` is the whole compiler-option pair tsgo consults, not just
   * `module`: an absent `module` is NOT "ask Node", it is "derive the kind from
   * `target`" (tsgo's `getEmitModuleKind`), and TypeScript 7 defaults `target`
   * to the latest standard, which means ES modules. Only the `node*` family
   * defers to the nearest `package.json` `type`, because only that family makes
   * tsgo consult it.
   *
   * `options` is `null` for a file no tsconfig owns at all — a raw `.ts`
   * shipped under `node_modules`. Nothing emitted it, so Node's own rule is the
   * only rule there is, and the package `type` decides.
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
    // authored ESM syntax verbatim whatever the package `type` says) is emitted
    // as ECMAScript modules. `amd`, `umd`, and `system` are not among them:
    // TypeScript 7 removed all three, so a project declaring one cannot build,
    // and a file it would have owned reaches the run through the orphan lane
    // instead.
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

  /** Package-type cache keyed by directory, mirroring Node's own lookup walk. */
  const packageTypeCache = new Map<string, "module" | "commonjs">();

  function nearestPackageType(filename: string): "module" | "commonjs" {
    let directory = path.dirname(filename);
    const chain: string[] = [];
    while (true) {
      const cached = packageTypeCache.get(directory);
      if (cached !== undefined) {
        return rememberPackageType(chain, cached);
      }
      chain.push(directory);
      const type = readPackageType(directory);
      if (type !== null) {
        return rememberPackageType(chain, type);
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return rememberPackageType(chain, "commonjs");
      }
      directory = parent;
    }
  }

  function rememberPackageType(
    directories: readonly string[],
    type: "module" | "commonjs",
  ): "module" | "commonjs" {
    for (const directory of directories) {
      packageTypeCache.set(directory, type);
    }
    return type;
  }

  /** Read a directory's `package.json` `type`, or `null` when absent/invalid. */
  function readPackageType(directory: string): "module" | "commonjs" | null {
    const manifestPath = path.join(directory, "package.json");
    if (!RuntimeFilesystem.isFile(manifestPath)) {
      return null;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        type?: unknown;
      };
      return parsed.type === "module" ? "module" : "commonjs";
    } catch {
      return "commonjs";
    }
  }

  /**
   * The `"type"` the nearest `package.json` states outright, or `null` when the
   * nearest manifest omits it (or there is none).
   *
   * `nearestPackageType` answers "what format would Node use", which defaults a
   * silent manifest to CommonJS. This answers the narrower question "did a
   * package actually say", which is what an override has to be built on: a
   * manifest that says nothing must not out-vote the compiling project's own
   * `module` option.
   */
  function declaredPackageType(filename: string): "module" | "commonjs" | null {
    let directory = path.dirname(filename);
    while (true) {
      const manifestPath = path.join(directory, "package.json");
      if (RuntimeFilesystem.isFile(manifestPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
            type?: unknown;
          };
          // The walk stops at the first manifest either way, exactly as Node's
          // package-scope lookup does; only the answer differs.
          return parsed.type === "module" || parsed.type === "commonjs"
            ? parsed.type
            : null;
        } catch {
          return null;
        }
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return null;
      }
      directory = parent;
    }
  }
}
