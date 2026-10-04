import path from "node:path";

import type { TtscServiceRequestOptions } from "./TtscServiceRequestOptions";
import type { ResidentTransformProcess } from "./compiler/internal/ResidentTransformProcess";
import { startResidentTransform } from "./compiler/internal/startResidentTransform";
import { CompilerContextSnapshot } from "./internal/CompilerContextSnapshot";
import { resolvePhysicalPath } from "./internal/pathIdentity/resolvePhysicalPath";
import type { ITtscCompilerContext } from "./structures/ITtscCompilerContext";

/**
 * Resident, incremental transform service for the `ttsc` TypeScript-Go
 * pipeline.
 *
 * Where {@link TtscCompiler.transform} spawns a fresh process and recompiles the
 * whole project on every call, `TtscService` shares one long-lived host across
 * per-file transform and update requests. The serve producer owns initial
 * compilation, transformed-text reuse and later generations; custom executable
 * hosts must honor that protocol rather than the wrapper proving their cache
 * behavior. One service instance can address many files. One host serves one
 * process; sharing it across separate worker processes (a Metro worker pool)
 * is not provided.
 *
 * The shape mirrors a legacy TypeScript `LanguageService`: construct it against
 * a project context, ask it to transform individual files, and dispose it when
 * done. Construction is synchronous (it launches the host); the host compiles
 * in the background; the first {@link transformFile} waits for its host reply
 * and can reject on startup or protocol failure.
 *
 * Resident mode runs through a selected shared host, so the project must
 * declare at least one transform-stage plugin; the constructor throws
 * otherwise. It does not run check-stage plugins (unlike
 * {@link TtscCompiler.transform}); program loading and transform-stage plugin
 * success gate an {@link updateFile} in the utility producer. A selected executable plugin host must implement the
 * resident serve protocol; the generated linked-plugin utility host supplies
 * that protocol itself.
 *
 * @evidence contracts/common.md#principled-implementation One resident host owns committed transform state and validated transform/update replies; fixed context selectors and captured JSON configuration preserve construction authority while later requests address the selected project's logical spelling. The utility producer retains printed text after closing each loaded Program.
 * @evidence contracts/common.md#clear-and-simple-design The class exposes transform, update and disposal around one resident client; private path adaptation handles the physical-versus-program spelling distinction without duplicating client protocol state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The resident protocol is an actual required host capability, not an assumed executable property; failed compile/protocol replies remain failures rather than fabricated absent files or successful updates.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain resident lifetime, transform/check-stage scope, custom serve requirement and captured configuration; method comments distinguish absence, rejected builds and disposal consequences.
 * @evidence contracts/portability.md#os-neutral-implementation Native physical resolution and path-relative containment map aliases back to retained Program spelling, including Windows 8.3 roots; native host spawning and environment authority stay with the resident client owner.
 * @evidence contracts/performance.md#efficient-algorithms Construction delegates configuration/plugin discovery and native startup; requests delegate host processing, serialization and reply parsing. Best-effort path adaptation traverses native ancestors/text and can perform Windows case-query work; returned text and submitted content add data costs without a wrapper compile.
 * @evidence contracts/performance.md#reuse-equivalent-work The same service shares one selected serve producer; current transformed output and ordered generation replacement are producer responsibilities, not a custom-host cache guarantee authenticated by this wrapper.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One resident client retains its child and pending requests without a queue or active-duration cap. Disposal or terminal failure rejects pending work, closes pipes and attempts signals; void disposal neither awaits child close nor guarantees OS termination or host memory release.
 */
export class TtscService {
  private readonly resident: ResidentTransformProcess;
  private readonly projectRoot: string;
  private readonly physicalProjectRoot: string;

  /**
   * Create a service bound to the given project context and launch its resident
   * host. The context is the same shape {@link TtscCompiler} accepts; it is not
   * replaceable per call.
   *
   * Plugin JSON conversion, including custom `toJSON`, is captured once before
   * launching the host. Unsupported cyclic or BigInt payloads fail here.
   */
  public constructor(context: ITtscCompilerContext = {}) {
    const started = startResidentTransform(
      CompilerContextSnapshot.clone(context),
    );
    this.resident = started.process;
    // The Program keeps this spelling, including a Windows 8.3 component.
    this.projectRoot = started.projectRoot;
    this.physicalProjectRoot = resolvePhysicalPath(started.projectRoot);
  }

  /**
   * Return the transformed TypeScript source for one file, or `undefined` when
   * the resident program does not contain it (for example a file excluded from
   * the tsconfig). A relative `fileName` is resolved against the project root.
   *
   * Rejects when the resident host failed to compile the project; the rejection
   * carries the host's diagnostics so callers can surface a real build error.
   *
   * @evidence contracts/common.md#principled-implementation Only a validated found=false reply means absence; found replies supply transformed text, while compilation or protocol errors reject instead of collapsing into undefined.
   * @evidence contracts/common.md#clear-and-simple-design One resident request uses private path adaptation and returns the reply's text without a second file lookup or compilation policy.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The client validates the real protocol shape; this method neither fabricates text nor hides host failure as an excluded source.
   * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain project-relative filenames, absent-program-file meaning and diagnostic rejection, with prose separated from tags.
   * @evidence contracts/portability.md#os-neutral-implementation Best-effort native physical resolution maps contained aliases to the retained logical root spelling; fallback paths are not a continuing identity certificate. fileName is structured request data rather than shell text.
   * @evidence contracts/performance.md#efficient-algorithms One path adaptation and resident request delegate ancestor/case observations, request serialization, host lookup and reply parsing; path and response text contribute cost. The wrapper itself launches no new compile.
   * @evidence contracts/performance.md#reuse-equivalent-work Resident program output is shared until an update changes its generation; file lookup uses that current program rather than an independent stale response cache.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One pending request and returned text belong to this call; the client owns cancellation/terminal settlement with no implicit per-call deadline. Queued cancellation can retire sibling calls; disposal attempts signals without a child-close join.
   */
  public async transformFile(
    fileName: string,
    options: TtscServiceRequestOptions = {},
  ): Promise<string | undefined> {
    const reply = await this.resident.request(
      { file: this.absolutePath(fileName) },
      "transform",
      options,
    );
    // The resident client already validated the reply shape (boolean `found`,
    // string `typescript` when found), so a malformed or wrong-shape reply
    // rejected instead of reaching here. `found: false` is the only path to
    // `undefined`; a protocol failure never masquerades as an absent file.
    return reply.found === true && typeof reply.typescript === "string"
      ? reply.typescript
      : undefined;
  }

  /**
   * Apply new in-memory content for one file and re-transform the project, so a
   * subsequent {@link transformFile} reflects the edit without restarting the
   * host. Returns whether the re-transform succeeded; `false` means the edit
   * failed the host's rebuild and the previous transform is still in effect.
   * In the utility producer this includes load/type-check or transform-plugin
   * failure; custom hosts must honor the same update protocol. A relative
   * `fileName` is resolved against the project root.
   *
   * @evidence contracts/common.md#principled-implementation A validated updated boolean reports the producer's edit result; the utility host rolls failed rebuilds back to its prior overlay and transformed text. Custom host compliance is a protocol requirement, not compilation independently observed by this wrapper.
   * @evidence contracts/common.md#clear-and-simple-design The method sends one content/path update through the resident client and leaves generation replacement and reply validation to their owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The host's real updated reply determines the result; protocol failure rejects instead of being converted into false or an invented successful edit.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes rejected builds, false update results and subsequent transform visibility, with separated acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation Native path adaptation supplies the resident Program spelling while content travels as structured text, without shell interpretation or platform-specific separators in protocol logic.
   * @evidence contracts/performance.md#efficient-algorithms One content update delegates the producer's re-transform strategy; this wrapper adds best-effort ancestor/case/path adaptation, content serialization and reply parsing. Returned boolean selection has fixed shape, but native/path/content/host work is not constant.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Updating resident source changes program state and cannot be shared solely because request text matches a previous effectful call.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The pending request retains serialized content and callbacks until client settlement; accepted generations belong to the producer. Disposal or terminal failure clears pending work and attempts signals without proving child termination; queued cancellation also retires sibling requests.
   */
  public async updateFile(
    fileName: string,
    content: string,
    options: TtscServiceRequestOptions = {},
  ): Promise<boolean> {
    const reply = await this.resident.request(
      { content, update: this.absolutePath(fileName) },
      "update",
      options,
    );
    // The resident client validated the reply carries a boolean `updated`, so a
    // malformed or wrong-shape reply rejected instead of collapsing to `false`.
    // `false` reports a failed host rebuild, not a separately observed cause.
    return reply.updated === true;
  }

  /**
   * Reject in-flight requests, close client pipes and attempt host termination.
   * Returns without waiting for child close; OS signaling can fail.
   *
   * @evidence contracts/common.md#principled-implementation Delegating to the client retires request ownership and rejects pending work, then attempts supported pipe destruction and child signals without certifying process closure.
   * @evidence contracts/common.md#clear-and-simple-design Disposal has one resident owner; this wrapper keeps no second shutdown state or listener registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported client termination path is used without replacing child methods or pretending outstanding transforms completed.
   * @evidence contracts/common.md#meaningful-documentation Native wording distinguishes pending-request rejection and termination attempts from an awaited child-close receipt.
   * @evidence contracts/portability.md#os-neutral-implementation Child termination is delegated to the Node resident client instead of an OS-specific shell kill command.
   *
   * @evidence contracts/performance.md#efficient-algorithms One delegate retires the client; that owner scans outstanding request slots and removes listeners before native pipe/signal attempts. Fixed wrapper steps do not make shutdown independent of pending population.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal is an ownership-ending effect, not a computation whose output authorizes shared execution.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The client rejects requests and closes pipes, with one unreferenced grace timer attempting forced termination. Repeated disposal respects terminal state; failed signaling may leave the child alive, and this method supplies no process-tree or close join.
   */
  public dispose(): void {
    this.resident.dispose();
  }

  private absolutePath(fileName: string): string {
    const physical = resolvePhysicalPath(
      path.resolve(this.projectRoot, fileName),
    );
    const relative = path.relative(this.physicalProjectRoot, physical);
    // Compare both sides physically, then address an in-project file exactly as
    // the resident Program names it. Its source lookup compares names, not
    // filesystem identities, and on Windows it may retain an 8.3 root.
    return relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
      ? physical
      : path.join(this.projectRoot, relative);
  }
}
