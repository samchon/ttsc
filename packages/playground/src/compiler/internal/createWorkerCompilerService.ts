// Worker-side playground compiler core.
//
// This is the dependency-injected implementation behind the public
// `createWorkerCompiler`. It takes the `@ttsc/wasm` boot + result-parsing
// functions as `deps` instead of importing them at runtime, so the whole
// service — including plugin success/failure interpretation — can be exercised
// against a fake `IBootResult` without building or booting WASM. The public
// wrapper supplies the real `bootTtsc` / `parseResult`.
import type {
  IBootResult,
  IBootTtscOptions,
  ITtscCompileResult,
  ITtscResult,
} from "@ttsc/wasm";

import type { ICompilerService } from "../../structures/ICompilerService";
import type { ICreateWorkerCompilerOptions } from "../../structures/ICreateWorkerCompilerOptions";
import type { ITransformOptions } from "../../structures/ITransformOptions";
import { DEFAULT_ENTRY_FILE } from "../DEFAULT_ENTRY_FILE";
import { DEFAULT_LINT_PLUGIN_NAME } from "../DEFAULT_LINT_PLUGIN_NAME";
import { DEFAULT_TSCONFIG_PATH } from "../DEFAULT_TSCONFIG_PATH";
import { DEFAULT_TYPIA_PLUGIN_NAME } from "../DEFAULT_TYPIA_PLUGIN_NAME";
import { DEFAULT_WORK_DIR } from "../DEFAULT_WORK_DIR";
import { buildTsconfigJSON } from "../buildTsconfigJSON";
import { installDependenciesIntoMemFS } from "../installDependenciesIntoMemFS";
import { mapDiagnostic } from "../mapDiagnostic";
import { normalizeError } from "../normalizeError";
import { pickEmittedJS } from "../pickEmittedJS";
import { joinUnder } from "./joinUnder";
import { parseLintDiagnostics } from "./parseLintDiagnostics";
import { safeParseTypiaTransform } from "./safeParseTypiaTransform";

/**
 * Runtime `@ttsc/wasm` collaborators the worker compiler needs. The public
 * `createWorkerCompiler` binds the real implementations; tests bind fakes that
 * resolve a synthetic `IBootResult` so the plugin-envelope handling can be
 * verified without a real WASM boot.
 */
export interface IWorkerCompilerDeps {
  bootTtsc: (options: IBootTtscOptions) => Promise<IBootResult>;
  parseResult: <T>(result: ITtscResult) => T | null;
}

/** Outcome of a transform-verb plugin call before the build proceeds. */
type ITransformOutcome = { ok: true } | { ok: false; message: string };

/**
 * Dependency-injected worker `ICompilerService` factory. See
 * `createWorkerCompiler` for the public entry documentation.
 */
export function createWorkerCompilerService(
  deps: IWorkerCompilerDeps,
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
      const result = await deps.bootTtsc({
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
  //
  // A configured transform that does not complete successfully is a failure,
  // NOT a silent fall-through to compiling the original source: a nonzero
  // process envelope, a rejected call, or output that cannot be parsed all
  // return `{ ok: false }` so `runBuildPipeline` surfaces the failure instead
  // of emitting untransformed JavaScript.
  const applyTypiaTransform = async (
    api: IBootResult["api"],
    host: IBootResult["host"],
  ): Promise<ITransformOutcome> => {
    if (!typiaPlugin) return { ok: true };
    let raw: ITtscResult;
    try {
      raw = await api.plugin({
        name: typiaPluginName,
        command: "transform",
        cwd: workDir,
        tsconfig: tsconfigPath,
        output: "ts",
      });
    } catch (error) {
      return { ok: false, message: messageOf(error) };
    }
    if (raw.code !== 0) {
      return {
        ok: false,
        message: pluginFailureMessage(raw, typiaPluginName, "transform"),
      };
    }
    // Success with no payload: nothing to rewrite, let the build run as-is.
    if (!raw.stdout) return { ok: true };
    const transformed = safeParseTypiaTransform(raw.stdout);
    if (!transformed) {
      return {
        ok: false,
        message: `ttsc: ${typiaPluginName} transform produced unparseable output`,
      };
    }
    for (const [rel, text] of Object.entries(transformed.typescript)) {
      host.writeFile(joinUnder(workDir, rel), text);
    }
    return { ok: true };
  };

  const runBuildPipeline = async (
    source: string,
    runTypia: boolean,
    tsconfigText: string,
  ): Promise<ICompilerService.IResult> => {
    try {
      const { api, host } = await getBoot();
      writeProject(host, projectFiles(source, tsconfigText));
      if (runTypia) {
        const outcome = await applyTypiaTransform(api, host);
        if (!outcome.ok) {
          return {
            type: "error",
            target: "javascript",
            value: { message: outcome.message },
          };
        }
      }
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
      const parsed = deps.parseResult<ITtscCompileResult>(raw);
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
  //
  // A finished lint run reports its findings the same way whether the process
  // exited 0 or nonzero (a linter exits nonzero when it finds violations), so
  // parsed diagnostics are always returned as-is. But a plugin that failed to
  // run — a rejected call, or a nonzero exit whose stderr yields no diagnostic
  // — must NOT collapse into an empty (clean) result; it surfaces a single
  // error diagnostic so the failure stays visible.
  const runLintPipeline = async (
    source: string,
  ): Promise<ICompilerService.ILintResult> => {
    if (!lintPlugin) return { diagnostics: [] };
    let raw: ITtscResult;
    try {
      const { api, host } = await getBoot();
      writeProject(host, projectFiles(source, tsconfigESM));
      raw = await api.plugin({
        name: lintPluginName,
        command: "check",
        cwd: workDir,
        tsconfig: tsconfigPath,
      });
    } catch (error) {
      return { diagnostics: [pluginFailureDiagnostic(messageOf(error))] };
    }
    const diagnostics = parseLintDiagnostics(raw.stderr, source);
    if (diagnostics.length === 0 && raw.code !== 0) {
      return {
        diagnostics: [
          pluginFailureDiagnostic(
            pluginFailureMessage(raw, lintPluginName, "check"),
          ),
        ],
      };
    }
    return { diagnostics };
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

/** Human-readable message for a nonzero plugin process envelope. */
function pluginFailureMessage(
  raw: ITtscResult,
  name: string,
  verb: string,
): string {
  return (
    raw.stderr.trim() ||
    raw.stdout.trim() ||
    `ttsc: ${name} ${verb} plugin failed (exit code ${raw.code})`
  );
}

/** Message of a rejected plugin call. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in (error as Record<string, unknown>)
  )
    return String((error as { message: unknown }).message);
  return String(error);
}

/**
 * A synthetic error diagnostic representing a lint plugin that failed to run.
 * Anchored at the start of the source so it renders like any other finding and
 * keeps the lint result non-empty (never a false "clean" report).
 */
function pluginFailureDiagnostic(
  message: string,
): ICompilerService.IDiagnostic {
  return {
    line: 1,
    column: 1,
    length: 1,
    severity: "error",
    message,
    code: "PLUGIN",
  };
}
