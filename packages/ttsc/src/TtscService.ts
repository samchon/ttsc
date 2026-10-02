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
 * whole project on every call, `TtscService` keeps one long-lived host warm: it
 * compiles the project once and then answers per-file transform requests from
 * that warm program. A single service instance transforms many files (a watch
 * server, an editor session, a codegen tool) while paying the project compile
 * once instead of once per file. One host serves one
 * process; sharing it across separate worker processes (a Metro worker pool)
 * is not provided.
 *
 * The shape mirrors a legacy TypeScript `LanguageService`: construct it against
 * a project context, ask it to transform individual files, and dispose it when
 * done. Construction is synchronous (it launches the host); the host compiles
 * in the background, so the first {@link transformFile} resolves once that
 * compile lands.
 *
 * Resident mode runs through a selected shared host, so the project must
 * declare at least one transform-stage plugin; the constructor throws
 * otherwise. It does not run check-stage plugins (unlike
 * {@link TtscCompiler.transform}); only the program's own type-checking gates an
 * {@link updateFile}. A selected executable plugin host must implement the
 * resident serve protocol; the generated linked-plugin utility host supplies
 * that protocol itself.
 *
 * @evidence contracts/common.md#principled-implementation One resident host owns a program generation and validated transform/update replies; fixed context selectors and captured JSON configuration preserve construction authority while later requests address that program's own logical spelling.
 * @evidence contracts/common.md#clear-and-simple-design The class exposes transform, update and disposal around one resident client; private path adaptation handles the physical-versus-program spelling distinction without duplicating client protocol state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The resident protocol is an actual required host capability, not an assumed executable property; failed compile/protocol replies remain failures rather than fabricated absent files or successful updates.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain resident lifetime, transform/check-stage scope, custom serve requirement and captured configuration; method comments distinguish absence, rejected builds and disposal consequences.
 * @evidence contracts/portability.md#os-neutral-implementation Native physical resolution and path-relative containment map aliases back to retained Program spelling, including Windows 8.3 roots; native host spawning and environment authority stay with the resident client owner.
 * @evidence contracts/performance.md#efficient-algorithms Requests reuse the resident program instead of recompiling solely to read one transformed file; path adaptation costs the filename/ancestor resolution and reply handling costs returned text.
 * @evidence contracts/performance.md#reuse-equivalent-work The same service shares one compiled program and its transformed files; update requests establish a new program generation rather than reusing stale source results across changed content.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The service owns one child and its resident program until dispose or terminal failure; its client settles queued requests on termination, while outstanding request count has no class-level cap.
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
   * @evidence contracts/portability.md#os-neutral-implementation The private path helper resolves native aliases and preserves the Program's logical root spelling; fileName is structured request data rather than shell text.
   * @evidence contracts/performance.md#efficient-algorithms One path adaptation and one resident lookup retrieve the already transformed file; response allocation scales with text length without a new compile.
   * @evidence contracts/performance.md#reuse-equivalent-work Resident program output is shared until an update changes its generation; file lookup uses that current program rather than an independent stale response cache.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One pending request and returned text belong to this call; the client owns cancellation/terminal settlement and the service owns the resident child until dispose, with no implicit per-call deadline.
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
   * did not compile and the previous transform is still in effect. A relative
   * `fileName` is resolved against the project root.
   *
   * @evidence contracts/common.md#principled-implementation A validated updated boolean reports the resident program's edit result; an unsuccessful compile retains its prior transformed generation rather than claiming a newly valid output.
   * @evidence contracts/common.md#clear-and-simple-design The method sends one content/path update through the resident client and leaves generation replacement and reply validation to their owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual compilation determines updated state; protocol failure rejects instead of being converted into false or an invented successful edit.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes rejected builds, false update results and subsequent transform visibility, with separated acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation Native path adaptation supplies the resident Program spelling while content travels as structured text, without shell interpretation or platform-specific separators in protocol logic.
   * @evidence contracts/performance.md#efficient-algorithms One content update triggers the resident owner's re-transform strategy; this wrapper adds path resolution and constant-size result handling rather than another compilation.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Updating resident source changes program state and cannot be shared solely because request text matches a previous effectful call.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The request owns its submitted content until the resident client settles it; accepted generations are retained by the resident program, and disposal or terminal failure releases pending client work.
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
    // `false` here means only that the edit did not compile.
    return reply.updated === true;
  }

  /**
   * Terminate the resident host and reject any in-flight requests.
   *
   * @evidence contracts/common.md#principled-implementation Delegating to the client closes the child ownership boundary and settles pending work rather than merely marking the service inactive.
   * @evidence contracts/common.md#clear-and-simple-design Disposal has one resident owner; this wrapper keeps no second shutdown state or listener registry.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The supported client termination path is used without replacing child methods or pretending outstanding transforms completed.
   * @evidence contracts/common.md#meaningful-documentation Native wording states both process termination and pending-request rejection, the caller-visible effects of disposal.
   * @evidence contracts/portability.md#os-neutral-implementation Child termination is delegated to the Node resident client instead of an OS-specific shell kill command.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms This wrapper delegates shutdown and chooses no separate computation algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Disposal is an ownership-ending effect, not a computation whose output authorizes shared execution.
   *
   * @evidence contracts/performance.md#bound-retention-and-release-resources The resident client terminates the owned child and rejects in-flight requests; repeated disposal follows that owner's terminal state instead of retaining another cleanup task.
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
