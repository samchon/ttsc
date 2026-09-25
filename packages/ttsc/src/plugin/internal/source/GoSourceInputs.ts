import fs from "node:fs";
import path from "node:path";

/**
 * What of a Go source plugin, and of its toolchain, the build and the cache key
 * both see.
 *
 * The source walk and the cache key must agree on which files count, or an
 * irrelevant file would bust the cached binary (or a relevant one would not),
 * and the build must run with the same toolchain environment the key hashed.
 */
export namespace GoSourceInputs {
  /**
   * Names of directories that never contribute plugin source: a nested
   * `node_modules`, a repository's `.git`, and ttsc's own `.ttsc`. An observer
   * outside this package, such as `ttscserver`'s native host, is handed this
   * list rather than a copy of it (samchon/ttsc#1507).
   */
  export const PRUNED_SOURCE_DIRECTORY_NAMES: readonly string[] = [
    "node_modules",
    ".git",
    ".ttsc",
  ];

  const PRUNE_DIRS = new Set(PRUNED_SOURCE_DIRECTORY_NAMES);

  const GENERATED_WORKSPACE_FILES = new Set(["go.work", "go.work.sum"]);

  /**
   * The environment of a `go` invocation: `GOWORK=auto`, ttsc's own `GOCACHE`
   * when a cache root is given (only the real build writes it), and `GOROOT`
   * inferred from the binary's location when the environment does not set one.
   */
  export function goBuildEnv(
    goBinary: string,
    goBuildCacheRoot?: string,
    effectiveEnv: NodeJS.ProcessEnv = process.env,
  ): NodeJS.ProcessEnv {
    const env = { ...effectiveEnv };
    env.GOWORK = "auto";
    // Only the actual `go build` needs ttsc's GOCACHE; read-only metadata spawns
    // (`go mod edit`, `go env`, `go version`) call goBuildEnv with no cache root
    // and inherit the ambient GOCACHE, which they never write to anyway. GOCACHE
    // is not part of the plugin cache key, so this cannot affect it.
    if (goBuildCacheRoot) {
      env.GOCACHE = goBuildCacheRoot;
    }
    const goRoot = inferGoRoot(goBinary);
    if (goRoot && !env.GOROOT) {
      env.GOROOT = goRoot;
    }
    return env;
  }

  /**
   * The Go root of an absolute `<root>/bin/go` binary, verified by the presence
   * of `<root>/src/runtime`; `null` when the layout does not match.
   */
  export function inferGoRoot(goBinary: string): string | null {
    if (!path.isAbsolute(goBinary)) return null;
    const binDir = path.dirname(goBinary);
    if (path.basename(binDir) !== "bin") return null;
    const goRoot = path.dirname(binDir);
    return fs.existsSync(path.join(goRoot, "src", "runtime")) ? goRoot : null;
  }

  /**
   * Whether a directory never contributes plugin source: `node_modules`,
   * `.git`, and ttsc's own `.ttsc`.
   */
  export function shouldPruneDirectory(name: string): boolean {
    return PRUNE_DIRS.has(name);
  }

  /**
   * Names of files that are local build residue rather than plugin source:
   * generated workspace files and operating-system sidecars. They drift
   * independently of the Go source and would otherwise enter the cache key and
   * bust the cached binary on every unrelated editor or file-browser visit. An
   * observer that runs outside this package, such as `ttscserver`'s native
   * host, is handed this list rather than a copy of it (samchon/ttsc#1507).
   */
  export const OMITTED_SOURCE_FILE_NAMES: readonly string[] = [
    ...GENERATED_WORKSPACE_FILES,
    ".DS_Store",
    "Thumbs.db",
  ];

  /**
   * Suffixes of files that are local build residue rather than plugin source:
   * `npm pack` tarballs and editor backups ending in `~`.
   */
  export const OMITTED_SOURCE_FILE_SUFFIXES: readonly string[] = [
    ".tgz",
    ".tar.gz",
    "~",
  ];

  /**
   * Whether a file is local build residue rather than plugin source
   * (`OMITTED_SOURCE_FILE_NAMES`, `OMITTED_SOURCE_FILE_SUFFIXES`).
   */
  export function shouldOmitSourceFile(name: string): boolean {
    return (
      OMITTED_SOURCE_FILE_NAMES.includes(name) ||
      OMITTED_SOURCE_FILE_SUFFIXES.some((suffix) => name.endsWith(suffix))
    );
  }
}
