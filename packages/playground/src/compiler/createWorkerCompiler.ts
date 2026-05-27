// Worker-side playground compiler factory.
//
// This module ships a ready-to-bind `ICompilerService` implementation. The
// consumer's worker entry boots the wasm once, builds tsconfig variants for
// the site's chosen module shape, registers the typia/lint plugin verbs (or
// the site-provided overrides), and serializes every MemFS-mutating call onto
// a single chain so concurrent compiles never corrupt each other.

import {
  type IBootResult,
  type ITtscCompileResult,
  bootTtsc,
  parseResult,
} from "@ttsc/wasm";

import type { ICompilerService } from "../structures/ICompilerService";
import type { ICreateWorkerCompilerOptions } from "../structures/ICreateWorkerCompilerOptions";
import type { ITransformOptions } from "../structures/ITransformOptions";
import { buildTsconfigJSON } from "./buildTsconfigJSON";
import { DEFAULT_ENTRY_FILE } from "./DEFAULT_ENTRY_FILE";
import { DEFAULT_LINT_PLUGIN_NAME } from "./DEFAULT_LINT_PLUGIN_NAME";
import { DEFAULT_TSCONFIG_PATH } from "./DEFAULT_TSCONFIG_PATH";
import { DEFAULT_TYPIA_PLUGIN_NAME } from "./DEFAULT_TYPIA_PLUGIN_NAME";
import { DEFAULT_WORK_DIR } from "./DEFAULT_WORK_DIR";
import { installDependenciesIntoMemFS } from "./installDependenciesIntoMemFS";
import { joinUnder } from "./internal/joinUnder";
import { parseLintDiagnostics } from "./internal/parseLintDiagnostics";
import { safeParseTypiaTransform } from "./internal/safeParseTypiaTransform";
import { mapDiagnostic } from "./mapDiagnostic";
import { normalizeError } from "./normalizeError";
import { pickEmittedJS } from "./pickEmittedJS";

/**
 * Build an `ICompilerService` ready to register with tgrid's `WorkerServer`.
 *
 * Usage in the worker entry:
 *
 * ```ts
 * import { createWorkerCompiler } from "@ttsc/playground";
 * import { WorkerServer } from "tgrid";
 *
 * const service = createWorkerCompiler({
 *   wasmUrl: "/compiler/playground.wasm",
 *   apiName: "ttscPlayground",
 *   typiaPlugin: { mount: installTypiaPack },
 * });
 *
 * const main = async () => {
 *   const worker = new WorkerServer();
 *   await worker.open(service);
 * };
 * void main();
 * ```
 */
export function createWorkerCompiler(
  options: ICreateWorkerCompilerOptions,
): ICompilerService {
  const workDir = options.workDir ?? DEFAULT_WORK_DIR;
  const tsconfigPath = options.tsconfigPath ?? DEFAULT_TSCONFIG_PATH;
  const entryFile = options.entryFile ?? DEFAULT_ENTRY_FILE;

  const typiaPlugin =
    options.typiaPlugin === false ? null : (options.typiaPlugin ?? {});
  const typiaPluginName = typiaPlugin?.name ?? DEFAULT_TYPIA_PLUGIN_NAME;
  const typiaTransformModule =
    typiaPlugin?.transformModule ?? "typia/lib/transform";

  const lintPlugin =
    options.lintPlugin === false ? null : (options.lintPlugin ?? {});
  const lintPluginName = lintPlugin?.name ?? DEFAULT_LINT_PLUGIN_NAME;

  // tsconfig variants. ESM for the "Compiled JS" preview lane, CommonJS for
  // the bundle/Execute lane (whose `new Function` driver expects CJS).
  const tsconfigPlugins = typiaPlugin
    ? [{ transform: typiaTransformModule }]
    : [];
  const extraCompilerOptions = {
    ...(options.extraCompilerOptions ?? {}),
    ...(tsconfigPlugins.length > 0 ? { plugins: tsconfigPlugins } : {}),
  };
  const tsconfigESM = buildTsconfigJSON({
    module: "ESNext",
    compilerOptions: extraCompilerOptions,
  });
  const tsconfigCJS = buildTsconfigJSON({
    module: "CommonJS",
    compilerOptions: extraCompilerOptions,
  });

  // Cache the boot promise across calls. If the boot rejects we clear the
  // cache so the next call retries — otherwise every later compile/bundle/
  // lint would replay the same rejection forever (page reload required).
  // Mirrors the createCompilerClient (UI-side) pattern.
  let boot: Promise<IBootResult> | null = null;
  function getBoot(): Promise<IBootResult> {
    if (boot) return boot;
    boot = (async () => {
      const result = await bootTtsc({
        wasmUrl: options.wasmUrl,
        wasmExecUrl: options.wasmExecUrl,
        apiName: options.apiName,
      });
      if (typiaPlugin?.mount) await typiaPlugin.mount(result.host, workDir);
      return result;
    })().catch((err) => {
      boot = null;
      throw err;
    });
    return boot;
  }

  // Serialize every MemFS-mutating call. tgrid queues incoming messages, but
  // the wasm-side host runs them concurrently — a fast keystroke could
  // interleave a bundle's tsconfig rewrite with a lint pass and corrupt
  // either result. The chain keeps compile/bundle/lint linear.
  let busy: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = busy.then(fn, fn);
    busy = next.catch(() => {});
    return next;
  };

  const projectFiles = (
    source: string,
    tsconfigText: string,
  ): Record<string, string> => ({
    [`${workDir}/${tsconfigPath}`]: tsconfigText,
    [`${workDir}/${entryFile}`]: source,
  });

  const writeProject = (
    host: IBootResult["host"],
    files: Record<string, string>,
  ): void => {
    for (const [path, text] of Object.entries(files)) {
      host.writeFile(path, text);
    }
  };

  // Typia transform — run the registered typia plugin's `transform` verb,
  // parse its JSON stdout, and write the rewritten TS back into MemFS so the
  // subsequent `api.build` sees the post-transform text.
  const applyTypiaTransform = async (
    api: IBootResult["api"],
    host: IBootResult["host"],
  ): Promise<void> => {
    if (!typiaPlugin) return;
    try {
      const raw = await api.plugin({
        name: typiaPluginName,
        command: "transform",
        cwd: workDir,
        tsconfig: tsconfigPath,
        output: "ts",
      });
      if (!raw.stdout) return;
      const transformed = safeParseTypiaTransform(raw.stdout);
      if (!transformed) return;
      for (const [rel, text] of Object.entries(transformed.typescript)) {
        host.writeFile(joinUnder(workDir, rel), text);
      }
    } catch {
      // Swallow plugin spawn / JSON parse failures so the user still sees the
      // tsgo compile diagnostics from the subsequent build call. Real
      // user-facing errors (e.g. typia rule violations) flow through the
      // wasm-side diagnostics path.
    }
  };

  const runBuildPipeline = async (
    source: string,
    runTypia: boolean,
    tsconfigText: string,
  ): Promise<ICompilerService.IResult> => {
    try {
      const { api, host } = await getBoot();
      writeProject(host, projectFiles(source, tsconfigText));
      if (runTypia) await applyTypiaTransform(api, host);
      const raw = await api.build({
        cwd: workDir,
        tsconfig: tsconfigPath,
      });
      if (raw.code !== 0 && !raw.result) {
        return {
          type: "error",
          target: "javascript",
          value: {
            message:
              raw.stderr || "ttsc: build failed without a result payload",
          },
        };
      }
      const parsed = parseResult<ITtscCompileResult>(raw);
      if (!parsed) {
        return {
          type: "error",
          target: "javascript",
          value: { message: "ttsc: result JSON could not be parsed" },
        };
      }
      const diagnostics = (parsed.diagnostics ?? []).map((d) =>
        mapDiagnostic(d, source),
      );
      const js = pickEmittedJS(parsed.output ?? {}, entryFile);
      const errors = diagnostics.filter((d) => d.severity === "error");
      if (errors.length > 0) {
        return {
          type: "failure",
          target: "javascript",
          value: js ?? "",
          diagnostics,
        };
      }
      return { type: "success", target: "javascript", value: js ?? "" };
    } catch (error) {
      return {
        type: "error",
        target: "javascript",
        value: normalizeError(error),
      };
    }
  };

  // Lint pipeline. The lint plugin emits tsgo-style pretty diagnostics on
  // stderr; we parse those lines back into IDiagnostic so the UI can render
  // them in the Lint tab.
  const runLintPipeline = async (
    source: string,
  ): Promise<ICompilerService.ILintResult> => {
    if (!lintPlugin) return { diagnostics: [] };
    try {
      const { api, host } = await getBoot();
      writeProject(host, projectFiles(source, tsconfigESM));
      const raw = await api.plugin({
        name: lintPluginName,
        command: "check",
        cwd: workDir,
        tsconfig: tsconfigPath,
      });
      return { diagnostics: parseLintDiagnostics(raw.stderr, source) };
    } catch {
      return { diagnostics: [] };
    }
  };

  return {
    installDependencies: (props) =>
      enqueue(async () => {
        const { host } = await getBoot();
        return installDependenciesIntoMemFS(host, workDir, props);
      }),
    compile: (props) =>
      enqueue(() =>
        runBuildPipeline(
          props.source,
          shouldRunTypia(props.options),
          tsconfigESM,
        ),
      ),
    bundle: (props) =>
      enqueue(() =>
        runBuildPipeline(
          props.source,
          shouldRunTypia(props.options),
          tsconfigCJS,
        ),
      ),
    lint: (props) => enqueue(() => runLintPipeline(props.source)),
  };
}

function shouldRunTypia(options?: ITransformOptions): boolean {
  return options?.typia !== false;
}
