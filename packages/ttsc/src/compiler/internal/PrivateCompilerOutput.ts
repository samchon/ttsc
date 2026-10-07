import fs from "node:fs";
import path from "node:path";

import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";
import { privateRuntimeRootDir } from "./build/privateRuntimeRootDir";
import type { RunBuildOptions } from "./build/RunBuildOptions";
import { isOutsideRelativePath } from "./isOutsideRelativePath";

/**
 * Compiler destinations and artifact translation for a single in-memory API
 * request. Native options retain distinct JavaScript, declaration, bundle and
 * incremental coordinates while all actual writes belong to one private tree.
 *
 * @evidence contracts/common.md#principled-implementation Destination translation and returned-artifact translation share one inverse mapping, preserving original public paths while native writes use private paths.
 * @evidence contracts/common.md#clear-and-simple-design This namespace groups one API output policy; shared build execution consumes its destination record without owning API artifact keys.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler-supported destinations are used instead of foreign filesystem interception or deleting caller artifacts after a write.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes private actual writes from public artifact locations; operation comments document relative map and incremental path ownership.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups operations; its path-owning members document the native boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace chooses no processing strategy independent of its members.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The namespace retains no shared computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The API call owns the private directory lifetime.
 */
export namespace PrivateCompilerOutput {
/**
 * Relocate each compiler destination independently. Directory mappings retain
 * the compiler's per-source layout; exact mappings keep bundle and incremental
 * names independent of that layout. A private explicit build-info path avoids
 * inferred paths above outDir for deeply nested rootDir values. Independent
 * checks use another state file so diagnostic recovery cannot overwrite or
 * masquerade as an emitted API artifact.
 * Only a newly added outDir needs private root pinning. Relocating a configured
 * outDir retains native inferred layout and its configuration diagnostics.
 *
 * @evidence contracts/common.md#principled-implementation Separate native destinations have inverse mappings to original artifact locations. Only originally source-adjacent emission receives root pinning; configured outDir retains native inferred layout and diagnostics. Inferred state follows pinned outputpaths.GetBuildInfoFileName config/rootDir/outDir rules; explicit private state prevents upward escapes and independent checks use a separate non-artifact destination.
 * @evidence contracts/common.md#clear-and-simple-design One request-local mapping joins destination selection and artifact translation, preserving bundle/declaration distinctions at the API boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Output destination options preserve incremental checking and separate bundle/declaration output instead of disabling them or cleaning caller paths after publication.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains path ownership, independent output kinds and why inferred incremental metadata needs an explicit private location.
 * @evidence contracts/portability.md#os-neutral-implementation Node path resolution and relative paths preserve native volume boundaries and separators; protocol text normalizes host separators only.
 * @evidence contracts/performance.md#efficient-algorithms At most four destination mappings are allocated. Native path resolution, root-relative inference and each inverse lookup operate on a bounded number of path strings and cost their actual text lengths; no caller tree is traversed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request observes new compiler input and owns its output; no cross-request result cache is introduced.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Mapping and returned text are request-local data; compileProjectInMemory owns acquisition and finally removal of the private tree.
 */
export function create(
  project: ITtscParsedProjectConfig,
  directory: string,
): {
  /** Compiler destinations used only within the owning temporary tree. */
  destinations: NonNullable<RunBuildOptions["privateOutputDestinations"]>;

  /** Pin layout only when adding an outDir to an originally adjacent emit. */
  pinInferredRootDir: boolean;

  /** Map a captured native output path back to its original artifact location. */
  originalPath: (file: string) => string;
} {
  const options = project.compilerOptions;
  const mappings: { privatePath: string; originalPath: string; kind: "directory" | "file" | "bundle" }[] = [];
  const relocate = (name: string, original: string, kind: "directory" | "file" | "bundle"): string => {
    const privatePath = path.join(directory, name, ...(kind === "directory" ? [] : [path.basename(original)]));
    mappings.push({ privatePath, originalPath: original, kind });
    return privatePath;
  };
  const outFile = typeof options.outFile === "string" ? options.outFile : undefined;
  const sourceRoot = privateRuntimeRootDir(project.root, options.rootDir, options.composite);
  const destinations: NonNullable<RunBuildOptions["privateOutputDestinations"]> = {
    outDir: outFile !== undefined && options.outDir === undefined ? null :
      relocate("javascript", options.outDir ?? sourceRoot, "directory"),
    declarationDir: typeof options.declarationDir === "string" ?
      relocate("declarations", options.declarationDir, "directory") : null,
    outFile: outFile !== undefined ? relocate("bundle", outFile, "bundle") : null,
  };
  if (options.incremental === true || options.composite === true || typeof options.tsBuildInfoFile === "string") {
    let original = typeof options.tsBuildInfoFile === "string" ? options.tsBuildInfoFile : undefined;
    if (original === undefined) {
      const configStem = removeCompilerExtension(project.path);
      original = options.outDir !== undefined ? path.resolve(options.outDir,
          typeof options.rootDir === "string" ? path.relative(options.rootDir, configStem) : path.basename(configStem)) + ".tsbuildinfo" :
          configStem + ".tsbuildinfo";
    }
    destinations.tsBuildInfoFile = relocate("state", original, "file");
    destinations.diagnosticsTsBuildInfoFile = path.join(directory, "diagnostics", "state.tsbuildinfo");
  }
  return {
    destinations,
    pinInferredRootDir: options.outDir === undefined && destinations.outDir !== null,
    originalPath(file) {
      for (const mapping of mappings) {
        if (mapping.kind === "file") {
          if (file === mapping.privatePath) return mapping.originalPath;
        } else if (mapping.kind === "bundle") {
          if (file === mapping.privatePath) return mapping.originalPath;
          const privateStem = removeCompilerExtension(mapping.privatePath);
          if (file.startsWith(privateStem + "."))
            return removeCompilerExtension(mapping.originalPath) + file.slice(privateStem.length);
        } else {
          const relative = path.relative(mapping.privatePath, file);
          if (!isOutsideRelativePath(relative)) return path.join(mapping.originalPath, relative);
        }
      }
      return file;
    },
  };
}

/**
 * Return all captured compiler artifacts at their original API keys. Source
 * maps without compiler-owned sourceRoot/mapRoot need their relative sources
 * re-based from the private destination to the original destination. Explicit
 * roots already give sources their independent compiler-defined base.
 * Only the final compiler map trailer is translated; similar authored text
 * inside a multiline literal remains source text.
 *
 * Build information is identified by its selected path, including arbitrary
 * extensions. Recovery-only state is excluded by path; actual emitted state
 * remains an artifact even when the compiler also reports errors.
 *
 * @evidence contracts/common.md#principled-implementation Inverse destination mapping restores original keys as own data properties, including names inherited from Object.prototype. Maps without explicit sourceRoot/mapRoot rebase source paths through their private and original directories, preserving remote URLs and the pinned native generator's raw file-URL convention for different Windows roots without percent decoding filename data. Build-info source/option paths rebase similarly while special library names remain compiler identifiers. Only the separate check/recovery state is omitted; actual emission state and partial outputs remain captured.
 * @evidence contracts/common.md#clear-and-simple-design One request-local mapping joins destination selection and artifact translation, preserving bundle/declaration distinctions at the API boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Output destination options preserve incremental checking and separate bundle/declaration output instead of disabling them or cleaning caller paths after publication.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains path ownership, independent output kinds and why inferred incremental metadata needs an explicit private location.
 * @evidence contracts/portability.md#os-neutral-implementation Node path resolution and relative paths preserve native volume boundaries and separators; protocol text normalizes host separators only.
 * @evidence contracts/performance.md#efficient-algorithms The iterative walk visits E private directory entries, sorts F file paths with path-text comparison costs and reads B emitted bytes once. Map/state JSON parsing, translation and serialization cost their actual text and record sizes; retained output grows with B and the path keys.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request observes new compiler input and owns its output; no cross-request result cache is introduced.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Mapping and returned text are request-local data; compileProjectInMemory owns acquisition and finally removal of the private tree.
 */
export function read(
  project: ITtscParsedProjectConfig,
  directory: string,
  originalPath: (file: string) => string,
  buildInfoFile?: string,
  diagnosticState?: string,
): Record<string, string> {
  const output: Record<string, string> = {};
  for (const file of listFiles(directory)) {
    if (file === diagnosticState) continue;
    const original = originalPath(file);
    const relative = path.relative(project.root, original);
    const key = pathToKey(isOutsideRelativePath(relative) ? original : relative);
    let text = fs.readFileSync(file, "utf8");
    const rebaseMap = (value: string): string => {
      const map = JSON.parse(value) as { sources?: string[]; sourceRoot?: string };
      if (!project.compilerOptions.sourceRoot && !project.compilerOptions.mapRoot && Array.isArray(map.sources))
        map.sources = map.sources.map((source) => {
          if (/^[a-z][a-z0-9+.-]*:/i.test(source) && !source.startsWith("file:")) return source;
          // Native tspath.GetRelativePathToDirectoryOrUrl prefixes disk paths
          // without URL encoding; percent escapes remain literal filename data.
          const nativeFile = source.startsWith("file:///") && /^[A-Za-z]:\//.test(source.slice(8)) ? source.slice(8) :
            source.startsWith("file://") ? source.slice(7) : undefined;
          const resolved = nativeFile ?? path.resolve(path.dirname(file), source);
          const relative = path.relative(path.dirname(original), resolved);
          const normalized = pathToKey(relative);
          return path.isAbsolute(relative) ? (normalized.startsWith("/") ? "file://" : "file:///") + normalized : normalized;
        });
      return JSON.stringify(map);
    };
    if (file !== buildInfoFile && file.endsWith(".map")) text = rebaseMap(text);
    else if (file !== buildInfoFile) {
      text = text.replace(/((?:^|\n)\/\/#[ \t]*sourceMappingURL=data:application\/json;base64,)([^\s]+)(?=\s*$)/,
        (_match, prefix: string, payload: string) => prefix + Buffer.from(rebaseMap(Buffer.from(payload, "base64").toString("utf8"))).toString("base64"));
      if (project.compilerOptions.mapRoot)
        text = text.replace(/((?:^|\n)\/\/#[ \t]*sourceMappingURL=)([^\s]+)(?=\s*$)/, (match, prefix: string, url: string) => {
          if (/^(?:[a-z]+:|\/)/i.test(url)) return match;
          return prefix + encodeURI(pathToKey(path.relative(path.dirname(original), path.resolve(path.dirname(file), decodeURI(url)))));
        });
    } else {
      const state = JSON.parse(text) as { fileNames?: string[]; options?: Record<string, unknown> };
      const rebase = (value: string): string => pathToKey(path.relative(path.dirname(original), originalPath(path.resolve(path.dirname(file), value))));
      if (Array.isArray(state.fileNames)) state.fileNames = state.fileNames.map((file) => /^lib\.[^/\\]+\.d\.ts$/.test(file) ? file : rebase(file));
      if (state.options !== undefined)
        for (const name of ["outDir", "outFile", "declarationDir", "tsBuildInfoFile", "rootDir"])
          if (typeof state.options[name] === "string") {
            if (typeof project.compilerOptions[name] !== "string") delete state.options[name];
            else state.options[name] = rebase(state.options[name]);
          }
      text = JSON.stringify(state);
    }
    Object.defineProperty(output, key, { value: text, enumerable: true, configurable: true, writable: true });
  }
  return output;
}

/** Match pinned tspath.RemoveFileExtension, including compound declaration suffixes. */
function removeCompilerExtension(file: string): string {
  return file.replace(/\.(?:d\.(?:ts|mts|cts)|mjs|mts|cjs|cts|ts|js|tsx|jsx|json)$/, "");
}

/** Recursively list all files under `directory`, sorted for stable output. */
function listFiles(directory: string): string[] {
  const out: string[] = [];
  const pending = [directory];
  while (pending.length !== 0) {
    const current = pending.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const location = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(location);
      } else if (entry.isFile()) {
        out.push(location);
      }
    }
  }
  return out.sort();
}

/**
 * Convert native separators, while retaining literal POSIX backslashes, for
 * output keys.
 */
function pathToKey(file: string): string {
  return file.replaceAll(path.sep, "/");
}

}
