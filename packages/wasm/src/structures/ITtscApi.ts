import type { ITtscBuildOpts } from "./ITtscBuildOpts";
import type { ITtscFileQuery } from "./ITtscFileQuery";
import type { ITtscPluginOpts } from "./ITtscPluginOpts";
import type { ITtscPositionQuery } from "./ITtscPositionQuery";
import type { ITtscResult } from "./ITtscResult";
import type { ITtscSnapshotHandle } from "./ITtscSnapshotHandle";
import type { ITtscVersion } from "./ITtscVersion";

/**
 * API object that every host-built wasm binds to `globalThis[apiName]`.
 *
 * Obtain an instance via `bootTtsc`, which waits for the wasm to signal
 * readiness and returns the typed handle together with its `IMemFSHost`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Signatures mirror host.Expose's direct metadata/list methods and asynchronous
 *   project/snapshot methods, sharing request DTOs and the native result envelope.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Named verbs distinguish project work from retained-program queries; requests
 *   share small DTOs and async results share one envelope. Direct metadata/list
 *   values stay synchronous because their native handlers do not load a project.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Queries address retained programs through opaque handles rather than
 *   substituting JavaScript source heuristics for compiler semantics.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates acquisition, decoding, coordinates and snapshot ownership,
 *   following the documentation skill's paragraph and context guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscApi only groups the wasm API verbs and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscApi only groups the wasm API verbs and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscApi only groups the wasm API verbs and coordinates no computation.
 */
export interface ITtscApi {
  /**
   * Build metadata reported synchronously by the wasm.
   *
   * @evidence contracts/common.md#principled-implementation The direct return mirrors jsVersion's synchronous projection.
   * @evidence contracts/common.md#clear-and-simple-design One direct metadata value requires no project request or asynchronous transport envelope.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Binary metadata supplies identity rather than a guessed browser or release constant.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states direct-return behavior under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources version is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms version is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work version is a signature only; sharing of repeated work belongs to the Go host.
   */
  version(): ITtscVersion;

  /**
   * Compile a project: typecheck + emit. `result` is JSON;
   * `parseResult<ITtscCompileResult>` deserializes it.
   *
   * @evidence contracts/common.md#principled-implementation The Promise envelope follows native Build and the shared project request.
   * @evidence contracts/common.md#clear-and-simple-design The named emit verb reuses project options and the result envelope without mixing no-emit switches into its request.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The loaded program supplies output, without a consumer-specific emitter path.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states purpose and decoding under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources build is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms build is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work build is a signature only; sharing of repeated work belongs to the Go host.
   */
  build(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Typecheck without emit. `result` is JSON; `parseResult<ITtscCompileResult>`
   * deserializes it.
   *
   * @evidence contracts/common.md#principled-implementation Native Check owns no-emit loading and the shared compile payload.
   * @evidence contracts/common.md#clear-and-simple-design A separate no-emit verb makes intent explicit while sharing project and diagnostic representations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No-emit is a loader option rather than pretending an emitted build was a check.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains no-emit and decoding under the documentation skill's clarity rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources check is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms check is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work check is a signature only; sharing of repeated work belongs to the Go host.
   */
  check(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Return source text keyed by project-relative path inside cwd and absolute
   * path outside it. Used by playgrounds that want to render the TypeScript
   * view after a source rewriter (e.g. paths) has run. `result` is JSON; use
   * `parseResult<ITtscTransformResult>` to deserialize.
   *
   * @evidence contracts/common.md#principled-implementation Native Transform projects post-plugin text through the shared project request.
   * @evidence contracts/common.md#clear-and-simple-design The source projection is its own verb and DTO, keeping emitted output distinct from transformed TypeScript.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Source comes from the transformed program rather than inference from emitted JavaScript.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains source stage, paths and decoding under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources transform is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms transform is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work transform is a signature only; sharing of repeated work belongs to the Go host.
   */
  transform(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Dispatch a registered plugin's subcommand. Returns the captured stdout /
   * stderr (the same streams the native sidecar binary would write to) together
   * with the exit code.
   *
   * @evidence contracts/common.md#principled-implementation Named dispatch adapts scalar options to a registered Go Plugin's command arguments.
   * @evidence contracts/common.md#clear-and-simple-design One dispatcher forwards plugin-owned arguments without adding a host endpoint for each plugin command.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Invocation-owned streams replace global-output mutation; command semantics stay with the plugin.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains dispatch and output ownership under the documentation skill's ownership rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources plugin is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms plugin is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work plugin is a signature only; sharing of repeated work belongs to the Go host.
   */
  plugin(opts: ITtscPluginOpts): Promise<ITtscResult>;

  /**
   * Names of registered plugins, returned synchronously.
   *
   * @evidence contracts/common.md#principled-implementation The direct array mirrors the native registry's name projection.
   * @evidence contracts/common.md#clear-and-simple-design A direct name list exposes registration discovery without leaking Plugin instances or invoking commands.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Entries describe linked registrations rather than a fixed list of npm packages.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states registry provenance and direct return under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources plugins is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms plugins is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work plugins is a signature only; sharing of repeated work belongs to the Go host.
   */
  plugins(): string[];

  /**
   * Load a project once and retain the TypeScript-Go Program in memory for
   * follow-up queries via the other fountain verbs.
   *
   * Callers MUST call `releaseSnapshot` for every handle they receive to free
   * the program's checker pool lease and let Go GC reclaim the AST. Use
   * `parseResult<ITtscSnapshotResult>` to read the handle.
   *
   * @evidence contracts/common.md#principled-implementation An opaque handle references a retained native program for repeated queries.
   * @evidence contracts/common.md#clear-and-simple-design Acquisition is distinct from querying and release, so the caller can identify its explicit retained-program lifetime.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Queries share the actual program rather than rebuilding approximations for each request.
   * @evidence contracts/common.md#meaningful-documentation Separate JSDoc paragraphs explain acquisition, decoding and release under the documentation skill.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources snapshot is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms snapshot is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work snapshot is a signature only; sharing of repeated work belongs to the Go host.
   */
  snapshot(opts: ITtscBuildOpts): Promise<ITtscResult>;

  /**
   * Drop a snapshot held by the wasm. Safe to call with an already-released
   * handle. The response's `released` flag will be `false`.
   *
   * @evidence contracts/common.md#principled-implementation Explicit release follows the registry's idempotent delete-and-close operation.
   * @evidence contracts/common.md#clear-and-simple-design One handle-based release operation owns cleanup instead of coupling it to an unrelated query result.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The owning registry controls release rather than a guessed JavaScript GC event.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains already-released behavior under the documentation skill's absence guidance.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources releaseSnapshot is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms releaseSnapshot is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work releaseSnapshot is a signature only; sharing of repeated work belongs to the Go host.
   */
  releaseSnapshot(opts: ITtscSnapshotHandle): Promise<ITtscResult>;

  /**
   * List currently retained snapshot handles in unspecified order.
   *
   * @evidence contracts/common.md#principled-implementation The Promise envelope projects the live native registry without exposing programs.
   * @evidence contracts/common.md#clear-and-simple-design The listing exposes only current handles and uses the same async envelope as other registry operations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Registry ownership supplies the list rather than a caller-side history.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states lifetime and order under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources snapshots is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms snapshots is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work snapshots is a signature only; sharing of repeated work belongs to the Go host.
   */
  snapshots(): Promise<ITtscResult>;

  /**
   * List non-declaration source paths held by the snapshot's program.
   *
   * @evidence contracts/common.md#principled-implementation A shared handle selects the retained program whose SourceFiles supplies the projection.
   * @evidence contracts/common.md#clear-and-simple-design File identities are queried separately from their text and semantic details to keep this projection focused.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler membership determines files rather than a filesystem glob approximation.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names snapshot provenance and declaration exclusion under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getSourceFiles is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getSourceFiles is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getSourceFiles is a signature only; sharing of repeated work belongs to the Go host.
   */
  getSourceFiles(opts: ITtscSnapshotHandle): Promise<ITtscResult>;

  /**
   * Read the current text the snapshot's program is holding for a file. After
   * transform-stage plugins ran inside this snapshot, the text reflects their
   * rewrites.
   *
   * @evidence contracts/common.md#principled-implementation A handle/file query reads the native program's current source text.
   * @evidence contracts/common.md#clear-and-simple-design The shared file query selects one source; its text-only payload avoids duplicating snapshot or AST state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Readback does not substitute an editor buffer that may differ from the retained program.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names retained and transformed text under the documentation skill's provenance guidance.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getSourceFileText is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getSourceFileText is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getSourceFileText is a signature only; sharing of repeated work belongs to the Go host.
   */
  getSourceFileText(opts: ITtscFileQuery): Promise<ITtscResult>;

  /**
   * Diagnostics from the snapshot's program. Pass `file` to filter to a single
   * project-relative or absolute path.
   *
   * @evidence contracts/common.md#principled-implementation Program diagnostics supply the result, narrowed by an optional file selector.
   * @evidence contracts/common.md#clear-and-simple-design One optional file filter refines the same diagnostic operation without another per-file endpoint.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Messages come from compiler diagnostics rather than a parallel source-pattern checker.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains filter identity under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getDiagnostics is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getDiagnostics is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getDiagnostics is a signature only; sharing of repeated work belongs to the Go host.
   */
  getDiagnostics(
    opts: ITtscSnapshotHandle & { file?: string },
  ): Promise<ITtscResult>;

  /**
   * Return the syntax token touching `position` (byte offset), including
   * punctuation. Returns `{node: null}` for whitespace and comments.
   *
   * @evidence contracts/common.md#principled-implementation Native astnav owns token lookup in the retained program using byte coordinates.
   * @evidence contracts/common.md#clear-and-simple-design The shared position request drives a syntax-only result, leaving checker-specific queries separate.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler AST semantics replace guessed JavaScript lexical scans.
   * @evidence contracts/common.md#meaningful-documentation JSDoc states units and null meaning under the documentation skill's coordinate/absence guidance.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getNodeAtPosition is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getNodeAtPosition is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getNodeAtPosition is a signature only; sharing of repeated work belongs to the Go host.
   */
  getNodeAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;

  /**
   * Resolve the token at `position` and return the enclosing TypeScript-Go
   * semantic node's printed type string + flags. Returns `{type: null}` when
   * the position has no token or no type-bearing token.
   *
   * @evidence contracts/common.md#principled-implementation The retained checker owns semantic lookup and printing after token navigation.
   * @evidence contracts/common.md#clear-and-simple-design Type presentation has its own nullable payload while using the same position selector as syntax and symbol queries.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Types come from compiler semantics rather than source spelling or a fabricated any result.
   * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes token and semantic lookup under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getTypeAtPosition is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getTypeAtPosition is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getTypeAtPosition is a signature only; sharing of repeated work belongs to the Go host.
   */
  getTypeAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;

  /**
   * Resolve the symbol the token at `position` refers to, including up to 16
   * declaration sites. Returns `{symbol: null}` when no symbol is bound.
   *
   * @evidence contracts/common.md#principled-implementation The retained checker resolves symbols and projects bounded declaration metadata.
   * @evidence contracts/common.md#clear-and-simple-design One symbol payload combines identity with a small declaration projection without adding follow-up declaration handles.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Declaration sites come from the symbol rather than searching text for equal names.
   * @evidence contracts/common.md#meaningful-documentation JSDoc explains the cap and null result under the documentation skill's context rule.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources getSymbolAtPosition is a signature only; the lifetime of what it touches belongs to the Go host.
   * @evidenceExclude contracts/performance.md#efficient-algorithms getSymbolAtPosition is a signature only; its algorithm and cost belong to the Go host.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work getSymbolAtPosition is a signature only; sharing of repeated work belongs to the Go host.
   */
  getSymbolAtPosition(opts: ITtscPositionQuery): Promise<ITtscResult>;
}
