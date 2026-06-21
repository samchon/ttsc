import path from "node:path";

import { startResidentTransform } from "./compiler/internal/startResidentTransform";
import type { ResidentTransformProcess } from "./compiler/internal/residentTransformProcess";
import type { ITtscCompilerContext } from "./structures/ITtscCompilerContext";

/**
 * Resident, incremental transform service for the `ttsc` TypeScript-Go pipeline.
 *
 * Where {@link TtscCompiler.transform} spawns a fresh process and recompiles the
 * whole project on every call, `TtscService` keeps one long-lived host warm: it
 * compiles the project once and then answers per-file transform requests from
 * that warm program. This is the resident host of samchon/ttsc#255 — a single
 * service shared across Metro workers or an editor session pays the project
 * compile once instead of once per file.
 *
 * The shape mirrors a legacy TypeScript `LanguageService`: construct it against
 * a project context, ask it to transform individual files, and dispose it when
 * done. Construction is synchronous (it launches the host); the host compiles
 * lazily, so the first {@link transformFile} resolves once that compile lands.
 *
 * Resident mode runs through the linked-plugin shared host, so the project must
 * declare at least one transform-stage plugin; the constructor throws otherwise.
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
    const absolute = path.isAbsolute(fileName)
      ? fileName
      : path.resolve(this.projectRoot, fileName);
    const reply = await this.resident.transformFile(absolute);
    return reply.found ? reply.typescript : undefined;
  }

  /** Terminate the resident host and reject any in-flight requests. */
  public dispose(): void {
    this.resident.dispose();
  }
}
