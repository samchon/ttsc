import fs from "node:fs";
import path from "node:path";

import { resolvePhysicalPath } from "../../../internal/pathIdentity/resolvePhysicalPath";
import { GoToolResolution } from "./GoToolResolution";
import type { IPluginModuleReplaceDirectory } from "./IPluginModuleReplaceDirectory";
import { resolveGoCompiler } from "./resolveGoCompiler";
import { selectPluginModuleReplaceDirectories } from "./selectPluginModuleReplaceDirectories";
import { SourcePluginWorkspace } from "./SourcePluginWorkspace";

/**
 * The local directories outside a plugin's Go module that its `go.mod`
 * `replace` directives name before the build prepares its scratch sources.
 *
 * A `replace` whose target is a filesystem path (Go's rule: absolute, or
 * beginning with `./` or `../`) makes the build compile that directory as the
 * replaced module. A target inside the module is copied and keyed with it. An
 * outside target supplies a separate source population: the cache key digests
 * it, the load reports its state among `pluginSources`, and a watch observes
 * it. buildSourcePlugin snapshots and proves that target's copy, then anchors
 * the replacement to the copy before compiling. A relative target also has to
 * resolve from the module's own directory, as it does for `go build` there, and
 * not from the scratch copy the build runs in.
 *
 * The directives are read through `go mod edit -json`, Go's own reading of
 * `go.mod`, not a copy of its grammar. Only the main module's directives count,
 * as Go ignores the `replace` directives of every other module.
 *
 * @param moduleRoot The plugin's Go module root, which holds its `go.mod`.
 * @param env The build's effective environment.
 * @param goBinary The Go tool the build runs, or `undefined` to resolve it as
 *   the build does.
 * @returns Each replacement outside the module, sorted by module path: the
 *   replaced module path and version, the target as `go.mod` spells it, and the
 *   target's absolute path.
 * @throws On non-ENOENT manifest reads, or when the replace-triggered Go query
 *   fails or supplies an unusable JSON result. A no-marker manifest skips Go
 *   parsing here; this is not general go.mod validation.
 * @evidence contracts/common.md#principled-implementation When the replace marker triggers a query, Go parses its grammar. Unversioned local targets selected outside best-effort root/target spellings are reported, resolving relative paths from the original module; unavailable identity resolution does not certify complete physical containment.
 * @evidence contracts/common.md#clear-and-simple-design A cheap no-replace scan avoids an unnecessary subprocess, while Go JSON parsing and physical containment stay in one owning operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The implementation uses Go's supported mod-edit interface instead of a handwritten grammar or special-casing particular dependency names.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain external versus internal replacement ownership, original-directory resolution and returned spellings; failure behavior is documented.
 * @evidence contracts/portability.md#os-neutral-implementation Node path and physical-path resolution determine containment; Go local-path syntax accepts native absolute paths and Windows-relative backslashes only on Windows.
 * @evidence contracts/performance.md#efficient-algorithms Full manifest read/UTF-8 marker scan can skip Go parsing. Otherwise native tool/env/capture and full JSON work precede a pass over all parsed directives, not only returned ones; each selected local target uses native best-effort identity resolution, which can traverse ancestors/probe case. Sorting returned module/version strings processes their bytes, with complete manifest/output/path arrays retained transiently and no replacement content digest scan here.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work The optional pinned-tool/load reader shares Go parsing of identical current bytes with package observation and workspace creation. Physical replacement containment is recomputed every call, never borrowed from that syntax memo.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This operation acquires no retained handle or historical registry; spawnGoTool owns synchronous capture and its cleanup attempts, which can fail. Manifest/JSON/native identity contexts are call-owned and selected records transfer to the caller without pinning future directory state.
 */
export function pluginModuleReplaceDirectories(
  moduleRoot: string,
  env: NodeJS.ProcessEnv,
  goBinary?: string,
  reader?: SourcePluginWorkspace.GoModReader,
): IPluginModuleReplaceDirectory[] {
  const root = path.resolve(moduleRoot);
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, "go.mod"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  // Every `replace` directive spells the word, so a file without it has none,
  // and Go need not be run to read it. A file with it is read by Go itself.
  if (!text.includes("replace")) return [];
  const go =
    goBinary ??
    GoToolResolution.resolveGoToolForBuild(
      resolveGoCompiler(env).binary,
      env,
      root,
    );
  const parsed = (reader ?? SourcePluginWorkspace.createGoModReader(go, root, env)).read(root);
  // Parsed syntax may be shared; physical containment is current native state
  // and must be recomputed even when these manifest bytes are unchanged.
  return selectPluginModuleReplaceDirectories(
    root,
    parsed.directives,
    resolvePhysicalPath,
  );
}
