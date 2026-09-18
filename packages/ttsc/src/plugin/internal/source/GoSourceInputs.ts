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
  const PRUNE_DIRS = new Set(["node_modules", ".git", ".ttsc"]);

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
   * Whether a directory never contributes plugin source: `node_modules`, `.git`,
   * and ttsc's own `.ttsc`.
   */
  export function shouldPruneDirectory(name: string): boolean {
    return PRUNE_DIRS.has(name);
  }

  /**
   * Whether a file is local build residue rather than plugin source: generated
   * workspace files, package tarballs, and editor sidecars.
   */
  export function shouldOmitSourceFile(name: string): boolean {
    if (GENERATED_WORKSPACE_FILES.has(name)) return true;
    // npm-pack tarballs and macOS/Windows editor sidecars are local
    // build artifacts that drift independently of the Go source. They
    // would otherwise enter the cache key and bust the cached binary on
    // every unrelated `npm pack` or editor save.
    if (name.endsWith(".tgz") || name.endsWith(".tar.gz")) return true;
    if (name === ".DS_Store" || name === "Thumbs.db") return true;
    return false;
  }
}
