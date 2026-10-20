import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { runtimeExecutableIdentity } from "../../../internal/runtimeExecutableIdentity";
import type { CompilerTarget } from "./CompilerTarget";
import { GoEnvironmentReading } from "./GoEnvironmentReading";
import { GoSourceInputs } from "./GoSourceInputs";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "./PluginContentIdentities";
import { PluginLoadAnswers } from "./PluginLoadAnswers";
import { SourcePluginAdmission } from "./SourcePluginAdmission";
import { copiesPluginSourceEntry } from "./copiesPluginSourceEntry";
import { formatGoWorkPath } from "./formatGoWorkPath";
import { spawnGoTool } from "./spawnGoTool";

/**
 * Share generated Go workspace policy between package selection and building.
 *
 * Package selection must use the builder's overlays, generated workspace and
 * selected tool rather than an ancestor go.work found in a source directory. A
 * load shares early replacement watch, package and build manifest records under
 * its pinned tool and effective environment; identical current bytes in
 * independently proven scratch inputs share their Go parse. A moved native tool
 * clears that reader's syntax memo, and a toolchain retry starts a new reader
 * scope. Each caller has a diagnostic view over the shared native reader state;
 * one plugin cannot inherit another plugin's failure label (#1720). Go supplies
 * the workspace's required Go and toolchain directives. These reads preserve
 * the existing installation/version and sequential-stability limits.
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
   * Write the native builder's generated workspace and let Go select its
   * version.
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
    // A TypeScript 7.1 target overlays bridges and facades. Each facade shares
    // its module path with a 7.0 shim that the ttsc module's own go.mod
    // replaces, so the shims become workspace replacements, which override
    // module replacements, rather than workspace modules.
    const bridged = useDirs.some((dir) =>
      (goModReader.read(dir).modulePath ?? "").startsWith(
        SourcePluginAdmission.BRIDGE_MODULE_PREFIX,
      ),
    );
    const shimReplaceLines: string[] = [];
    const effectiveUseDirs = useDirs.filter((dir) => {
      OwnedSynchronousProcess.checkpoint();
      const modulePath = goModReader.read(dir).modulePath;
      if (
        bridged &&
        modulePath !== null &&
        SourcePluginAdmission.isManagedShimModule(modulePath)
      ) {
        shimReplaceLines.push(
          `replace ${modulePath} => ${formatGoWorkPath(dir)}`,
        );
        return false;
      }
      return (
        sourceInfo.modulePath !== TTSC_GO_MODULE_PATH ||
        (modulePath !== null &&
          !SourcePluginAdmission.isManagedModule(modulePath))
      );
    });
    const useLines = ["\t."];
    for (const dir of effectiveUseDirs) {
      OwnedSynchronousProcess.checkpoint();
      useLines.push(`\t${formatGoWorkPath(dir)}`);
    }
    const replaceLines = [
      ...sourceBuildWorkspaceReplacements(effectiveUseDirs, goModReader),
      ...shimReplaceLines.sort(),
    ];
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
     * The optional diagnostic owner overrides the creating caller's label only;
     * it changes no selected-tool, environment or byte-content authority.
     *
     * @evidence contracts/common.md#principled-implementation The signature associates a native directory with the selected reader's Go-owned module and replacement observation.
     * @evidence contracts/common.md#clear-and-simple-design A directory and optional diagnostic label expose manifest policy without treating the label as native cache authority.
     * @evidence contracts/common.md#prohibited-implementation-shortcuts The signature supplies no parser, alternate selection policy or stability certificate.
     * @evidence contracts/common.md#meaningful-documentation Native prose states selected-context result ownership and the optional caller label, which changes failure attribution only.
     * @evidence contracts/portability.md#os-neutral-implementation The directory is a native filesystem path; its resolution belongs to the implementing reader.
     * @evidence contracts/performance.md#efficient-algorithms A method signature executes no algorithm; createGoModReader owns acquisition and parsing.
     * @evidence contracts/performance.md#reuse-equivalent-work Implementations supply observations within their selected tool/environment scope; this signature establishes no cross-context memo.
     * @evidence contracts/performance.md#bound-retention-and-release-resources The signature acquires no resource; record retention belongs to the reader's enclosing load or materialized build.
     */
    read(dir: string, diagnosticPlugin?: string): GoModInfo;
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
   * selected-tool/load context, including copied scratch modules. An optional
   * registry shares native reader state from the first watch query onward; its
   * owner must keep one fixed effective environment and discard it on retry.
   * Caller views share that native state and syntax, while each default
   * diagnostic label remains with its current caller.
   *
   * An optional record store carries the Go environment-file discovery hint
   * across processes, and the parse of identical bytes by the same Go command
   * (#1729): every launch otherwise ran `go mod edit -json` on an unchanged
   * `go.mod`. A recorded parse is keyed by the manifest bytes, the content
   * identities of the launcher and of the `GOROOT/bin/go` the live `go env
   * -json GOROOT` reports, the `GOENV` file's bytes, and every `GO*`/`CGO_*`
   * variable the command receives. It is consulted and written only under the
   * same qualified tool witness that admits in-load sharing, so the live
   * witness query still runs on every load.
   *
   * @evidence contracts/common.md#principled-implementation Actual go mod edit JSON determines module/replacement identities; current bytes, selected/dispatched-tool metadata and Go's environment-file witness qualify reuse under the existing metadata-distinguishability premise. Environment values are copied at reader creation. Missing go.mod returns the existing empty module observation, and moving tool/manifest inputs cannot publish a parsed record.
   * @evidence contracts/common.md#clear-and-simple-design One factory acquires load-owned native reader state by selected tool; a thin caller view forwards its diagnostic label without duplicating the byte-content map. Current reads and post-parse byte/tool comparisons qualify insertion.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No custom Go manifest parser or global context-insensitive memo is introduced.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and temporary cwd avoid deep Windows working-directory limits; the selected tool handles manifest syntax.
   * @evidence contracts/performance.md#efficient-algorithms Reader acquisition performs a selected-tool registry lookup; every nonmissing read qualifies tool/environment metadata and reads current manifest bytes. A cold or stale witness first observes the selected launcher; an unavailable or nonfile launcher skips optional environment acquisition and permits only the actual uncached parse attempt. An observed file lends its same pre-read stat to the witness before acquiring current Go values and GOENV evidence through the common reader, without a GOROOT walk. Only complete native GOENV/GOROOT locations qualify syntax sharing; a dispatched tool is witnessed before parsing. Unavailable native environment acquisition disables syntax sharing while preserving actual parse success or failure. Each distinct byte string that earns stable successful syntax in that tool epoch runs Go mod edit and complete JSON parsing once, then rechecks bytes/tool metadata before caching; copied manifests share that parse. Failed queries remain uncached and report the current caller's diagnostic label.
   * @evidence contracts/performance.md#reuse-equivalent-work The caller may share this reader only within one load and the same pinned tool/effective environment; parsed syntax is never native containment authority. Across loads only a parse recorded under the content identities of the bytes, both Go executables, the GOENV file and the Go variables is reused, and only under a qualified live tool witness. Caller views share native state while preserving failure attribution; diagnostic labels are not syntax cache inputs.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The map retains distinct manifest bytes and parsed syntax for its caller's load/build lifetime; process/output capture cleanup remains delegated.
   */
  export function createGoModReader(
    goBinary: string,
    pluginName: string,
    env: NodeJS.ProcessEnv,
    readers?: Map<string, GoModReader>,
    identities?: PluginContentIdentities.Store,
  ): GoModReader {
    const existing = readers?.get(goBinary);
    if (existing !== undefined)
      return {
        read: (dir, diagnosticPlugin = pluginName) =>
          existing.read(dir, diagnosticPlugin),
      };
    // WARNING (#1712): parse identical bytes once in this pinned tool/load
    // context, including early replacement watch projection and copied scratch
    // manifests. The optional registry belongs to one fixed effective environment
    // and one load; it is never shared with a toolchain retry. Always read current bytes;
    // a pathname or metadata-only memo misses manifest edits. Never promote
    // this map to a process cache: tool/environment epochs change Go authority.
    // Fixed variable strings do not freeze GOENV or a dispatched Go executable.
    // Requalify their actual native evidence before every syntax hit; missing
    // environment authority permits a fresh parse only, never positive reuse.
    // WARNING (#1720): diagnostic names are per caller, not a syntax/cache input.
    // Shared views must forward their current label to every failed native read.
    const cache = new Map<string, GoModInfo>();
    const environment = { ...env };
    let toolWitness: PluginBuildEnvironmentWitness.Record | undefined;
    // The tool part of a recorded parse's identity, formed with each qualified
    // witness; undefined without a store or a provable tool.
    let toolIdentity: unknown;
    const reader: GoModReader = {
      read(dir, diagnosticPlugin = pluginName) {
        OwnedSynchronousProcess.checkpoint();
        const resolved = path.resolve(dir);
        const manifest = path.join(resolved, "go.mod");
        let bytes: Buffer;
        try {
          bytes = fs.readFileSync(manifest);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT")
            return emptyGoModInfo();
          throw error;
        }
        if (
          toolWitness === undefined ||
          !PluginBuildEnvironmentWitness.holds(toolWitness)
        ) {
          cache.clear();
          const witness: PluginBuildEnvironmentWitness.Record = new Map();
          let launcher: fs.BigIntStats | undefined;
          try {
            launcher = fs.statSync(goBinary, { bigint: true });
          } catch {
            // Unavailable metadata cannot qualify optional syntax reuse.
          }
          if (launcher?.isFile() === true)
            PluginBuildEnvironmentWitness.add(witness, goBinary, launcher);
          // GOENV can change toolchain selection without changing env strings.
          // Share its existing native discovery owner; do not scan GOROOT here.
          // Do not launch a missing/unobservable tool twice just to learn that
          // optional cache qualification is unavailable (#1712). The actual
          // mod-edit attempt below still owns its current failure or success.
          const observed =
            launcher?.isFile() === true
              ? GoEnvironmentReading.read(
                  goBinary,
                  os.tmpdir(),
                  environment,
                  ["GOROOT"],
                  witness,
                  identities,
                )
              : undefined;
          if (
            typeof observed?.GOROOT === "string" &&
            path.isAbsolute(observed.GOROOT)
          )
            PluginBuildEnvironmentWitness.add(
              witness,
              path.join(
                observed.GOROOT,
                "bin",
                process.platform === "win32" ? "go.exe" : "go",
              ),
            );
          const complete =
            typeof observed?.GOROOT === "string" &&
            path.isAbsolute(observed.GOROOT) &&
            typeof observed.GOENV === "string" &&
            (observed.GOENV === "off" || path.isAbsolute(observed.GOENV));
          toolWitness =
            complete && PluginBuildEnvironmentWitness.holds(witness)
              ? witness
              : undefined;
          toolIdentity =
            toolWitness === undefined || identities === undefined
              ? undefined
              : goModToolIdentity(
                  goBinary,
                  observed!.GOROOT as string,
                  observed!.GOENV as string,
                  environment,
                  identities,
                );
        }
        // UTF-8 decoding is lossy for malformed input. Only identical bytes
        // can share Go syntax, even when Go serializes two inputs identically.
        const byteKey = bytes.toString("base64");
        const cached = cache.get(byteKey);
        if (cached !== undefined) {
          return cached;
        }
        // WARNING (#1729): a new process asks the record store before running
        // Go on bytes this exact command already parsed. Never key this on a
        // path or on the reader's metadata witness alone.
        const answer =
          toolIdentity === undefined
            ? undefined
            : [
                toolIdentity,
                crypto.createHash("sha256").update(bytes).digest("hex"),
              ];
        const recalled =
          answer === undefined
            ? undefined
            : recallGoModInfo(
                PluginLoadAnswers.read(identities, GO_MOD_SYNTAX, answer),
              );
        if (recalled !== undefined) {
          cache.set(byteKey, recalled);
          return recalled;
        }
        const info = readGoModInfo(
          resolved,
          goBinary,
          diagnosticPlugin,
          environment,
        );
        if (!fs.readFileSync(manifest).equals(bytes))
          throw new Error(
            `ttsc: go.mod changed while Go was reading ${manifest}`,
          );
        if (
          toolWitness !== undefined &&
          !PluginBuildEnvironmentWitness.holds(toolWitness)
        )
          throw new Error(
            `ttsc: Go tool or environment changed while reading ${manifest}`,
          );
        // An unavailable environment observation can still execute a fresh Go
        // parse, but it cannot authorize sharing that result on another call.
        if (toolWitness !== undefined) {
          cache.set(byteKey, info);
          if (answer !== undefined)
            PluginLoadAnswers.write(identities, GO_MOD_SYNTAX, answer, {
              modulePath: info.modulePath,
              directives: info.directives,
            });
        }
        return info;
      },
    };
    readers?.set(goBinary, reader);
    return reader;
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

  /** Answer family of `go mod edit -json` parses (`PluginLoadAnswers`). */
  const GO_MOD_SYNTAX = "go-mod-syntax";

  /**
   * Everything besides the manifest bytes that decides how `go mod edit -json`
   * parses them, by content: the launcher, the `GOROOT/bin/go` the live query
   * reported, the `GOENV` file that can select another toolchain, and the Go
   * variables the command receives. `undefined` when an executable cannot be
   * identified or the file cannot be read, so the parse runs.
   */
  function goModToolIdentity(
    goBinary: string,
    goRoot: string,
    goEnv: string,
    env: NodeJS.ProcessEnv,
    identities: PluginContentIdentities.Store,
  ): unknown {
    const dispatchedPath = path.join(
      goRoot,
      "bin",
      process.platform === "win32" ? "go.exe" : "go",
    );
    // Only an executable the store can prove from metadata may key the record:
    // streaming both executables on a device without a reference would cost
    // more than the parse it replaces.
    if (
      !provableFromMetadata(goBinary, identities) ||
      !provableFromMetadata(dispatchedPath, identities)
    )
      return undefined;
    const launcher = runtimeExecutableIdentity(goBinary, identities);
    const dispatched = runtimeExecutableIdentity(dispatchedPath, identities);
    if (launcher === undefined || dispatched === undefined) return undefined;
    let goEnvFile: string | null;
    if (goEnv === "off") goEnvFile = "off";
    else
      try {
        goEnvFile = crypto
          .createHash("sha256")
          .update(fs.readFileSync(goEnv))
          .digest("hex");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT")
          return undefined;
        goEnvFile = null;
      }
    return [
      1,
      launcher,
      goRoot,
      dispatched,
      goEnv,
      goEnvFile,
      Object.entries(GoSourceInputs.goBuildEnv(goBinary, undefined, env))
        .filter(
          (entry): entry is [string, string] =>
            entry[1] !== undefined && /^(GO|CGO_)/i.test(entry[0]),
        )
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
    ];
  }

  /**
   * Whether the file's stamp is separable from the store's reference on its
   * device, the precondition for proving its bytes from a record.
   */
  function provableFromMetadata(
    file: string,
    identities: PluginContentIdentities.Store,
  ): boolean {
    try {
      return PluginContentIdentities.separable(
        identities.references,
        fs.statSync(file, { bigint: true }),
      );
    } catch {
      return false;
    }
  }

  /**
   * A recorded parse in the shape `readGoModInfo` returns, or `undefined` when
   * the record does not have it.
   */
  function recallGoModInfo(value: unknown): GoModInfo | undefined {
    if (typeof value !== "object" || value === null) return undefined;
    const record = value as { modulePath?: unknown; directives?: unknown };
    if (
      (record.modulePath !== null && typeof record.modulePath !== "string") ||
      !Array.isArray(record.directives) ||
      !record.directives.every(isReplaceDirective)
    )
      return undefined;
    const directives = record.directives as NonNullable<GoModJson["Replace"]>;
    return {
      modulePath: record.modulePath,
      directives,
      replacements: directives
        .map(jsonReplacementToGoModReplacement)
        .filter((replacement) => replacement !== null),
    };
  }

  function isReplaceDirective(value: unknown): boolean {
    if (typeof value !== "object" || value === null) return false;
    const directive = value as Record<string, unknown>;
    return [directive.Old, directive.New].every(
      (side) =>
        side === undefined ||
        (typeof side === "object" &&
          side !== null &&
          ["Path", "Version"].every((key) => {
            const field = (side as Record<string, unknown>)[key];
            return field === undefined || typeof field === "string";
          })),
    );
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
   * Discover the installed native compiler/shim module overlays of a compiler
   * target: the ttsc module and, for 7.0, the shim tree, or for 7.1 its bridges
   * and facades. Omitting line selects 7.0.
   *
   * @evidence contracts/common.md#principled-implementation Existing ttsc and target shim go.mod files enter overlay selection under shared directory pruning policy; each line's tree is a separate directory, so one target's modules never enter another's workspace.
   * @evidence contracts/common.md#clear-and-simple-design One recursive walker gathers modules and one sort stabilizes ordering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No guessed list of shim modules replaces current filesystem discovery.
   * @evidence contracts/common.md#meaningful-documentation Native prose states this operation's authority and delegated boundaries; fields retain separate native comments.
   * @evidence contracts/portability.md#os-neutral-implementation Native fs/path operations retain platform spelling and directory kinds.
   * @evidence contracts/performance.md#efficient-algorithms Visits admitted directory entries recursively and sorts discovered module paths; lookup and path-byte costs remain delegated.
   * @evidence contracts/performance.md#reuse-equivalent-work Each call observes installed layout afresh; contextual module readers separately reuse manifest content observations.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Directory arrays/path strings live only for this call/result; synchronous fs calls retain no open handle.
   */
  export function findTtscOverlayDirs(
    line: CompilerTarget.Line = "7.0",
  ): readonly string[] {
    const ttscRoot = path.resolve(__dirname, "..", "..", "..", "..");
    const dirs: string[] = [];
    if (fs.existsSync(path.join(ttscRoot, "go.mod"))) {
      dirs.push(ttscRoot);
    }
    const shimRoot =
      line === "7.0"
        ? path.join(ttscRoot, "shim")
        : path.join(ttscRoot, "targets", line);
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
