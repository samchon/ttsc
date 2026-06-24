import path from "node:path";

import type { ResidentTransformProcess } from "./compiler/internal/residentTransformProcess";
import { startResidentTransform } from "./compiler/internal/startResidentTransform";
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
 * once instead of once per file. Sharing one host across separate worker
 * processes (a Metro worker pool) is tracked in samchon/ttsc#255.
 *
 * The shape mirrors a legacy TypeScript `LanguageService`: construct it against
 * a project context, ask it to transform individual files, and dispose it when
 * done. Construction is synchronous (it launches the host); the host compiles
 * in the background, so the first {@link transformFile} resolves once that
 * compile lands.
 *
 * Resident mode runs through the linked-plugin shared host, so the project must
 * declare at least one transform-stage plugin; the constructor throws
 * otherwise. It does not run check-stage plugins (unlike
 * {@link TtscCompiler.transform}); only the program's own type-checking gates an
 * {@link updateFile}.
 */
export class TtscService {
  private readonly resident: ResidentTransformProcess;
  private readonly projectRoot: string;

  /**
   * Create a service bound to the given project context and launch its resident
   * host. The context is the same shape {@link TtscCompiler} accepts; it is not
   * replaceable per call.
   */
  public constructor(context: ITtscCompilerContext = {}) {
    const started = startResidentTransform({
      ...context,
      env: context.env ? { ...context.env } : undefined,
      plugins: Array.isArray(context.plugins)
        ? [...context.plugins]
        : context.plugins,
    });
    this.resident = started.process;
    this.projectRoot = started.projectRoot;
  }

  /**
   * Return the transformed TypeScript source for one file, or `undefined` when
   * the resident program does not contain it (for example a file excluded from
   * the tsconfig). A relative `fileName` is resolved against the project root.
   *
   * Rejects when the resident host failed to compile the project; the rejection
   * carries the host's diagnostics so callers can surface a real build error.
   */
  public async transformFile(fileName: string): Promise<string | undefined> {
    const reply = await this.resident.request({
      file: this.absolutePath(fileName),
    });
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
   */
  public async updateFile(fileName: string, content: string): Promise<boolean> {
    const reply = await this.resident.request({
      content,
      update: this.absolutePath(fileName),
    });
    return reply.updated === true;
  }

  /** Terminate the resident host and reject any in-flight requests. */
  public dispose(): void {
    this.resident.dispose();
  }

  private absolutePath(fileName: string): string {
    return path.isAbsolute(fileName)
      ? fileName
      : path.resolve(this.projectRoot, fileName);
  }
}
