import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { GoSourceInputs } from "./GoSourceInputs";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { copiesPluginSourceEntry } from "./copiesPluginSourceEntry";
import { SourcePluginAdmission } from "./SourcePluginAdmission";
import { formatGoWorkPath } from "./formatGoWorkPath";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Share generated Go workspace policy between package selection and building.
 *
 * Package selection must use the builder's overlays, generated workspace and
 * selected tool rather than an ancestor go.work found in a source directory.
 * A load may share installed-overlay manifest records under its pinned tool
 * and effective environment; identical current bytes in independently proven
 * scratch inputs share their Go parse. A moved native tool clears that reader's
 * syntax memo, and a toolchain retry starts a new reader scope. Go
 * supplies the workspace's required Go and toolchain directives. These reads
 * preserve the existing installation/version and sequential-stability limits.
 *
 * @evidence contracts/common.md#principled-implementation Shared manifest acquisition, managed replacement admission, overlay filtering and Go-owned workspace version selection keep metadata and compilation under the same workspace policy; callers own source materialization and effective environment.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the generated workspace and its module reader, overlay discovery and Go launch diagnostics; no second manifest parser or build-tag interpreter is introduced.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual Go mod edit and work use commands interpret manifests; selected tool errors propagate and no static workspace version replaces Go's decision.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains shared policy and caller ownership; private helpers remain part of this operation's review surface.
 * @evidence contracts/portability.md#os-neutral-implementation Native fs/path operations preserve path spelling and formatGoWorkPath owns Go syntax quoting; subprocesses use the existing native wrapper owner with hidden windows.
 * @evidence contracts/performance.md#efficient-algorithms Workspace construction scans module and replacement populations; each reader reads current manifest bytes and memoizes equivalent Go syntax within its pinned native tool/load. Overlay discovery recursively scans admitted directories and sorts paths; native Go output and JSON parsing scale with complete bytes.
 * @evidence contracts/performance.md#reuse-equivalent-work Metadata and materialized builds share Go parsing only for identical current manifest bytes under the same pinned tool/effective environment. Independent materialization/content proof remains with each caller; tool movement clears syntax reuse and retries start another scope.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Readers retain module records only for their enclosing load or materialized build; command capture cleanup belongs to spawnGoTool and scratch lifetime belongs to the caller. Native commands can mutate Go-owned state and their selected-child completion does not prove arbitrary descendants retired.
 */
export namespace SourcePluginWorkspace {
  /**
   * Materialize one admitted source root under the native build copy policy.
   *
   * @evidence contracts/common.md#principled-implementation The shared source-entry predicate keeps native build and metadata copies under the keyed source policy; callers own root admission and any later digest proof.
   * @evidence contracts/common.md#clear-and-simple-design One recursive copy owner serves source modules and metadata contexts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No constraint interpretation or filename exception narrows the admitted copy.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes copying from later input-stability proof.
   * @evidence contracts/portability.md#os-neutral-implementation Native filesystem operations preserve supported path identity and the shared predicate refuses observed non-root links.
   * @evidence contracts/performance.md#efficient-algorithms Traverses admitted entries and copies their complete bytes; each entry checks cancellation and the shared naming/kind policy.
   * @evidence contracts/performance.md#reuse-equivalent-work The caller owns and reuses the resulting scratch; no historical copy cache is retained.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous copy retains no handle after returning; partial scratch cleanup remains with the enclosing metadata/build owner.
   */
  export function materialize(source: string, scratch: string): void {
    OwnedSynchronousProcess.checkpoint();
    fs.mkdirSync(scratch, { recursive: true });
    fs.cpSync(source, scratch, {
      recursive: true,
      filter: (input) => {
        OwnedSynchronousProcess.checkpoint();
        return copiesPluginSourceEntry(source, input);
      },
    });
  }

  /**
   * Write the native builder's generated workspace and let Go select its version.
   *
   * @evidence contracts/common.md#principled-implementation Actual manifest records drive managed overlay filtering and replacement admission; Go work use supplies required directives.
   * @evidence contracts/common.md#clear-and-simple-design The writer shares one reader across source/overlay queries and delegates manifest interpretation to Go.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No ancestor workspace or fixed Go version substitutes for this generated workspace; Go errors propagate.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths use formatGoWorkPath for Go syntax, and subprocess wrappers preserve native execution.
   * @evidence contracts/performance.md#efficient-algorithms Traverses admitted overlay/replacement records and emits complete workspace text; delegated Go commands process manifests.
   * @evidence contracts/performance.md#reuse-equivalent-work A supplied reader shares manifest observations with the same prepared-context caller; otherwise a private reader is allocated.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Workspace files belong to the caller's scratch; captures are released by spawnGoTool and module records by the reader's enclosing load.
   */
  export function writeGoWork(
    scratchDir: string,
    useDirs: readonly string[],
    goBinary: string,
    pluginName: string,
    env: NodeJS.ProcessEnv,
    goModReader: GoModReader = createGoModReader(goBinary, pluginName, env),
  ): void {
    validateSourceReplacements(scratchDir, useDirs, goModReader, pluginName);
    const sourceInfo = goModReader.read(scratchDir);
    const effectiveUseDirs =
      sourceInfo.modulePath === TTSC_GO_MODULE_PATH
        ? useDirs.filter((dir) => {
            OwnedSynchronousProcess.checkpoint();
            const modulePath = goModReader.read(dir).modulePath;
            return (
              modulePath !== null &&
              !SourcePluginAdmission.isManagedModule(modulePath)
            );
          })
        : useDirs;
    const useLines = ["\t."];
    for (const dir of effectiveUseDirs) {
      OwnedSynchronousProcess.checkpoint();
      useLines.push(`\t${formatGoWorkPath(dir)}`);
    }
    const replaceLines = sourceBuildWorkspaceReplacements(
      effectiveUseDirs,
      goModReader,
    );
    const replaceBlock =
      replaceLines.length === 0 ? "" : `\n\n${replaceLines.join("\n")}\n`;
    const goWork = `use (\n${useLines.join("\n")}\n)${replaceBlock}`;
    fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
    // The Go tool sets the workspace's `go` directive: `go work use` raises it to
    // what every listed module declares. A fixed directive rejects a module that
    // declares a patch release (`go 1.26.0` against `go 1.26`), and a module the
    // selected toolchain is too old for fails here with Go's own error.
    const settled = spawnGoTool(goBinary, ["work", "use"], {
      cwd: scratchDir,
      encoding: "utf8",
      env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
      windowsHide: true,
    });
    OwnedSynchronousProcess.checkpoint();
    if (settled.error) {
      throw new Error(
        goSpawnFailureMessage(
          `setting the Go workspace version for plugin "${pluginName}"`,
          pluginName,
          goBinary,
          scratchDir,
          settled.error,
        ),
      );
    }
    if (settled.status !== 0) {
      throw new Error(
        `ttsc: setting the Go workspace version for plugin "${pluginName}" failed:\n${settled.stderr || settled.stdout}`,
      );
    }
  }

  function validateSourceReplacements(
    scratchDir: string,
    useDirs: readonly string[],
    goModReader: GoModReader,
    pluginName: string,
  ): void {
    const sourceInfo = goModReader.read(scratchDir);
    if (sourceInfo.modulePath === TTSC_GO_MODULE_PATH) {
      return;
    }
    const sourceReplacements = sourceInfo.replacements;
    if (sourceReplacements.length === 0) {
      return;
    }
    const overlayModules = collectOverlayModulePaths(useDirs, goModReader);
    SourcePluginAdmission.requireSourceReplacements(
      sourceReplacements,
      overlayModules,
      pluginName,
    );
  }

  function sourceBuildWorkspaceReplacements(
    useDirs: readonly string[],
    goModReader: GoModReader,
  ): string[] {
    const ttscRoot = useDirs.find(
      (dir) => goModReader.read(dir).modulePath === TTSC_GO_MODULE_PATH,
    );
    if (!ttscRoot) {
      return [];
    }
    return [
      `replace ${TTSC_GO_MODULE_PATH} v0.0.0 => ${formatGoWorkPath(ttscRoot)}`,
    ];
  }

  interface GoModReplacement {
    readonly modulePath: string;
  }

  interface GoModInfo {
    readonly modulePath: string | null;
    readonly replacements: readonly GoModReplacement[];
    readonly directives: NonNullable<GoModJson["Replace"]>;
  }

  /**
   * One selected-context manifest reader.
   *
   * @evidence contracts/common.md#principled-implementation Records are actual Go observations owned by the selected tool/environment context.
   * @evidence contracts/common.md#clear-and-simple-design One read method exposes only module identity and replacement policy inputs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This type does not certify filesystem stability or manufacture compiler metadata.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation The supplied directory uses native spelling.
   * @evidence contracts/performance.md#efficient-algorithms This type executes no algorithm.
   * @evidence contracts/performance.md#reuse-equivalent-work Reuse belongs to createGoModReader and its caller's load scope.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The type acquires no handles; the actual reader owns its record map.
   */
  export interface GoModReader {
    /**
     * Observe the module at this native directory within the reader context.
     *
     * @evidence contracts/common.md#principled-implementation The signature associates a native directory with the selected reader's Go-owned module and replacement observation.
     * @evidence contracts/common.md#clear-and-simple-design One input and one record expose the manifest policy needed by the workspace writer.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature supplies no parser, alternate selection policy or stability certificate.
     * @evidence contracts/common.md#meaningful-documentation Native prose states that the result belongs to the reader context rather than a context-independent directory cache.
     * @evidence contracts/portability.md#os-neutral-implementation The directory is a native filesystem path; its resolution belongs to the implementing reader.
     * @evidence contracts/performance.md#efficient-algorithms A method signature executes no algorithm; createGoModReader owns acquisition and parsing.
     * @evidence contracts/performance.md#reuse-equivalent-work Implementations supply observations within their selected tool/environment scope; this signature establishes no cross-context memo.
     * @evidence contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource; record retention belongs to the reader's enclosing load or materialized build.
     */
    read(dir: string): GoModInfo;
  }

  interface GoModJson {
    readonly Module?: {
      readonly Path?: string;
    };
    readonly Require?: readonly {
      readonly Path?: string;
      readonly Version?: string;
    }[];
    readonly Replace?: readonly {
      readonly Old?: {
        readonly Path?: string;
        readonly Version?: string;
      };
      readonly New?: {
        readonly Path?: string;
        readonly Version?: string;
      };
    }[];
  }

  /**
   * Read current manifest bytes and share identical Go parses within one pinned
   * selected-tool/load context, including copied scratch modules.
   *
   * @evidence contracts/common.md#principled-implementation Actual go mod edit JSON determines module/replacement identities; current bytes and selected-tool metadata qualify reuse under the existing metadata-distinguishability premise. Environment values are copied at reader creation. Missing go.mod returns the existing empty module observation, and moving tool/manifest inputs cannot publish a parsed record.
   * @evidence contracts/common.md#clear-and-simple-design A byte-content map wraps one Go acquisition helper; current reads and a post-parse byte comparison qualify insertion.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No custom Go manifest parser or global context-insensitive memo is introduced.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and temporary cwd avoid deep Windows working-directory limits; the selected tool handles manifest syntax.
   * @evidence contracts/performance.md#efficient-algorithms Every call qualifies the selected tool's metadata and reads current manifest bytes. Each distinct byte string in that tool epoch runs Go mod edit and complete JSON parsing once, then rechecks bytes/tool metadata before caching; copied manifests share that parse.
   * @evidence contracts/performance.md#reuse-equivalent-work The caller may share this reader only within one load and the same pinned tool/effective environment; parsed syntax is not cross-load or native containment authority.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The map retains distinct manifest bytes and parsed syntax for its caller's load/build lifetime; process/output capture cleanup remains delegated.
   */
  export function createGoModReader(
    goBinary: string,
    pluginName: string,
    env: NodeJS.ProcessEnv,
  ): GoModReader {
    // WARNING (#1712): parse identical bytes once in this pinned tool/load
    // context, including copied scratch manifests. Always read current bytes;
    // a pathname or metadata-only memo misses manifest edits. Never promote
    // this map to a process cache: tool/environment epochs change Go authority.
    const cache = new Map<string, GoModInfo>();
    const environment = { ...env };
    let toolWitness: PluginBuildEnvironmentWitness.Record = new Map();
    PluginBuildEnvironmentWitness.add(toolWitness, goBinary);
    return {
      read(dir) {
        OwnedSynchronousProcess.checkpoint();
        if (!PluginBuildEnvironmentWitness.holds(toolWitness)) {
          cache.clear();
          toolWitness = new Map();
          PluginBuildEnvironmentWitness.add(toolWitness, goBinary);
        }
        const resolved = path.resolve(dir);
        const manifest = path.join(resolved, "go.mod");
        let text: string;
        try { text = fs.readFileSync(manifest, "utf8"); } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyGoModInfo();
          throw error;
        }
        const cached = cache.get(text);
        if (cached !== undefined) {
          return cached;
        }
        const info = readGoModInfo(resolved, goBinary, pluginName, environment);
        if (fs.readFileSync(manifest, "utf8") !== text)
          throw new Error(`ttsc: go.mod changed while Go was reading ${manifest}`);
        if (!PluginBuildEnvironmentWitness.holds(toolWitness))
          throw new Error(`ttsc: Go tool changed while reading ${manifest}`);
        cache.set(text, info);
        return info;
      },
    };
  }

  function readGoModInfo(
    dir: string,
    goBinary: string,
    pluginName: string,
    env: NodeJS.ProcessEnv,
  ): GoModInfo {
    if (!fs.existsSync(path.join(dir, "go.mod"))) {
      return emptyGoModInfo();
    }

    // `go mod edit` takes the file as an argument, so the tool runs from the
    // system temporary directory rather than from `dir`: a copy of an external
    // source mirrors its absolute path below the build's scratch directory, and
    // Windows refuses a working directory longer than MAX_PATH even where every
    // path the build itself opens is fine.
    const cwd = os.tmpdir();
    const result = spawnGoTool(
      goBinary,
      ["mod", "edit", "-json", path.join(dir, "go.mod")],
      {
        cwd,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      },
    );
    OwnedSynchronousProcess.checkpoint();
    if (result.error) {
      throw new Error(
        goSpawnFailureMessage(
          `reading go.mod for plugin "${pluginName}"`,
          pluginName,
          goBinary,
          cwd,
          result.error,
        ),
      );
    }
    if (result.status !== 0) {
      throw new Error(
        `ttsc: reading go.mod for plugin "${pluginName}" failed:\n${result.stderr || result.stdout}`,
      );
    }

    let json: GoModJson;
    try {
      json = JSON.parse(result.stdout) as GoModJson;
    } catch (error) {
      throw new Error(
        `ttsc: reading go.mod for plugin "${pluginName}" returned invalid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      modulePath: json.Module?.Path ?? null,
      directives: json.Replace ?? [],
      replacements: (json.Replace ?? [])
        .map(jsonReplacementToGoModReplacement)
        .filter((replacement) => replacement !== null),
    };
  }

  function emptyGoModInfo(): GoModInfo {
    return {
      modulePath: null,
      directives: [],
      replacements: [],
    };
  }

  function jsonReplacementToGoModReplacement(
    replacement: NonNullable<GoModJson["Replace"]>[number],
  ): GoModReplacement | null {
    const modulePath = replacement.Old?.Path;
    if (modulePath === undefined) {
      return null;
    }
    return {
      modulePath,
    };
  }

  function collectOverlayModulePaths(
    dirs: readonly string[],
    goModReader: GoModReader,
  ): Set<string> {
    const out = new Set<string>();
    for (const dir of dirs) {
      OwnedSynchronousProcess.checkpoint();
      const modulePath = goModReader.read(dir).modulePath;
      if (modulePath !== null) {
        out.add(modulePath);
      }
    }
    return out;
  }

  /**
   * Describe a failed Go launch without confusing missing cwd and missing tool.
   *
   * @evidence contracts/common.md#principled-implementation ENOENT means missing toolchain only when the selected absolute executable is not present; other failures retain executable/cwd/system error.
   * @evidence contracts/common.md#clear-and-simple-design One diagnostic adapter serves workspace and build commands.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing cwd is not mislabeled as a missing compiler.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native absolute-path/existence checks respect OS path semantics and original error codes.
   * @evidence contracts/performance.md#efficient-algorithms Fixed error/path checks and diagnostic text construction delegate native lookup costs.
   * @evidence contracts/performance.md#reuse-equivalent-work Current failure observations are interpreted independently, with no diagnostic cache.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No native handle or retained failure registry is acquired.
   */
  export function goSpawnFailureMessage(
    action: string,
    pluginName: string,
    goBinary: string,
    cwd: string,
    error: Error,
  ): string {
    if (
      (error as NodeJS.ErrnoException).code === "ENOENT" &&
      !(path.isAbsolute(goBinary) && fs.existsSync(goBinary))
    ) {
      return goToolchainNotFoundMessage(pluginName);
    }
    return `ttsc: ${action} failed to spawn ${goBinary} in ${cwd}: ${error.message}`;
  }

  function goToolchainNotFoundMessage(pluginName: string): string {
    return (
      `ttsc: building plugin "${pluginName}" failed because the Go toolchain was not found. ` +
      `Reinstall ttsc with optional dependencies so the bundled Go compiler is present, ` +
      `or set TTSC_GO_BINARY to an absolute path.`
    );
  }

  /**
   * Discover the installed native compiler/shim module overlays.
   *
   * @evidence contracts/common.md#principled-implementation Existing ttsc and shim go.mod files enter overlay selection under shared directory pruning policy.
   * @evidence contracts/common.md#clear-and-simple-design One recursive walker gathers modules and one sort stabilizes ordering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed list of shim modules replaces current filesystem discovery.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native fs/path operations retain platform spelling and directory kinds.
   * @evidence contracts/performance.md#efficient-algorithms Visits admitted directory entries recursively and sorts discovered module paths; lookup and path-byte costs remain delegated.
   * @evidence contracts/performance.md#reuse-equivalent-work Each call observes installed layout afresh; contextual module readers separately reuse manifest content observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Directory arrays/path strings live only for this call/result; synchronous fs calls retain no open handle.
   */
  export function findTtscOverlayDirs(): readonly string[] {
    const ttscRoot = path.resolve(__dirname, "..", "..", "..", "..");
    const dirs: string[] = [];
    if (fs.existsSync(path.join(ttscRoot, "go.mod"))) {
      dirs.push(ttscRoot);
    }
    const shimRoot = path.join(ttscRoot, "shim");
    if (fs.existsSync(shimRoot)) {
      walkForGoMod(shimRoot, dirs);
    }
    dirs.sort();
    return dirs;
  }

  function walkForGoMod(dir: string, out: string[]): void {
    OwnedSynchronousProcess.checkpoint();
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let hasGoMod = false;
    for (const entry of entries) {
      OwnedSynchronousProcess.checkpoint();
      if (entry.isFile() && entry.name === "go.mod") {
        hasGoMod = true;
      }
    }
    if (hasGoMod) {
      out.push(dir);
    }
    for (const entry of entries) {
      OwnedSynchronousProcess.checkpoint();
      if (!entry.isDirectory()) continue;
      if (GoSourceInputs.shouldPruneDirectory(entry.name)) continue;
      walkForGoMod(path.join(dir, entry.name), out);
    }
  }


  const TTSC_GO_MODULE_PATH = "github.com/samchon/ttsc/packages/ttsc";
}
