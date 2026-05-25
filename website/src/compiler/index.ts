// Playground compiler worker.
//
// Runs inside a Web Worker bundled by rspack (see `rspack.config.js` and
// `build/compiler.cjs`). The worker boots the `playground.wasm` binary the
// website ships under `public/compiler/`, which is a `@ttsc/wasm`-style
// consumer wasm produced from `website/compiler/cmd/playground/main_wasm.go`.
//
// The ICompilerService surface exposed over tgrid is the same one the
// PlaygroundShell consumes. `compile` projects the user's TypeScript source
// into a one-file in-memory project and asks the wasm to emit it.
import {
  type IBootResult,
  type ITtscCompileResult,
  bootTtsc,
  parseResult,
} from "@ttsc/wasm";
import { WorkerServer } from "tgrid";

import type { ICompilerService } from "./ICompilerService";
import type { ITransformOptions } from "./ITransformOptions";
import { installTypiaPack } from "./typia-pack";

const ENTRY_FILE = "src/playground.ts";
const WORK_DIR = "/work";
const TSCONFIG_PATH = "tsconfig.json";

// Boot the wasm exactly once. tgrid serializes incoming RPCs so we never have
// to worry about racing the boot. The typia source pack is mounted as part of
// boot so every later request finds `node_modules/typia/...` already on the
// in-memory FS.
let boot: Promise<IBootResult> | null = null;
function getBoot(): Promise<IBootResult> {
  if (!boot) {
    boot = (async () => {
      const result = await bootTtsc({
        wasmUrl: "/compiler/playground.wasm",
        wasmExecUrl: "/compiler/wasm_exec.js",
        apiName: "ttscPlayground",
      });
      await installTypiaPack(result.host);
      return result;
    })();
  }
  return boot;
}

interface IRunOptions {
  source: string;
  options?: ITransformOptions;
}

// Serialize every MemFS-mutating RPC: tgrid's `WorkerConnector` already
// queues messages, but the wasm-side host runs them concurrently. Lint and
// bundle both rewrite the MemFS layout (the same `/work/src/playground.ts`
// path); without a chain, a fast keystroke can interleave a bundle's `tsconfig`
// rewrite with a lint pass and corrupt either result. We keep all three
// (`compile`, `bundle`, `lint`) on the same chain because they all touch the
// same MemFS paths.
let busy: Promise<unknown> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = busy.then(fn, fn);
  busy = next.catch(() => {});
  return next;
};

// Both tsconfigs register typia's transform so the wasm-side typia plugin
// can pick up its feature flags from the project. They only differ in
// `module`: ESM for the "Compiled JS" preview, CommonJS for the Execute
// sandbox (whose `new Function("require, module, exports, console", code)`
// driver needs CJS).
const baseCompilerOptions = {
  target: "ESNext",
  moduleResolution: "Bundler",
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  strict: true,
  skipLibCheck: true,
  experimentalDecorators: true,
  outDir: "dist",
  rootDir: "src",
  plugins: [{ transform: "typia/lib/transform" }],
};

const tsconfigJSON = JSON.stringify({
  compilerOptions: { ...baseCompilerOptions, module: "ESNext" },
  include: ["src"],
});

const tsconfigCJSJSON = JSON.stringify({
  compilerOptions: { ...baseCompilerOptions, module: "CommonJS" },
  include: ["src"],
});

const projectFiles = (source: string): Record<string, string> => ({
  [`${WORK_DIR}/${TSCONFIG_PATH}`]: tsconfigJSON,
  [`${WORK_DIR}/${ENTRY_FILE}`]: source,
});

const writeProject = (
  host: IBootResult["host"],
  files: Record<string, string>,
): void => {
  for (const [path, text] of Object.entries(files)) {
    host.writeFile(path, text);
  }
};

const installDependencies = (
  props: ICompilerService.IInstallDependenciesProps,
): Promise<ICompilerService.IInstallDependenciesResult> =>
  enqueue(async () => {
    const { host } = await getBoot();
    let fileCount = 0;
    for (const [rel, text] of Object.entries(props.files)) {
      const normalized = normalizeNodeModulePath(rel);
      if (!normalized) continue;
      host.writeFile(`${WORK_DIR}/${normalized}`, text);
      fileCount++;
    }
    return { installed: props.packages, fileCount };
  });

const normalizeNodeModulePath = (path: string): string | null => {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized.startsWith("node_modules/")) return null;
  if (normalized.split("/").some((segment) => segment === "..")) return null;
  return normalized;
};

const lineColumnOf = (
  source: string,
  start: number | undefined,
): { line: number; column: number } => {
  if (typeof start !== "number" || start < 0) return { line: 1, column: 1 };
  const slice = source.slice(0, Math.min(start, source.length));
  const newlines = slice.match(/\n/g);
  const line = newlines ? newlines.length + 1 : 1;
  const lastNewline = slice.lastIndexOf("\n");
  const column =
    lastNewline === -1 ? slice.length + 1 : slice.length - lastNewline;
  return { line, column };
};

const mapDiagnostic = (
  diag: NonNullable<ITtscCompileResult["diagnostics"]>[number],
  source: string,
): ICompilerService.IDiagnostic => {
  const fallback = lineColumnOf(source, diag.start);
  return {
    line: diag.line && diag.line > 0 ? diag.line : fallback.line,
    column:
      diag.character && diag.character > 0 ? diag.character : fallback.column,
    length: typeof diag.length === "number" ? diag.length : 1,
    severity: diag.category === "warning" ? "warning" : "error",
    message: diag.messageText,
    code: typeof diag.code === "number" ? `TS${diag.code}` : String(diag.code),
  };
};

const pickEmittedJS = (output: Record<string, string>): string | null => {
  const candidates = [
    "dist/playground.js",
    "dist/src/playground.js",
    "src/playground.js",
    "playground.js",
  ];
  for (const key of candidates) {
    if (output[key] !== undefined) return output[key];
  }
  const jsKeys = Object.keys(output).filter((k) => k.endsWith(".js"));
  if (jsKeys.length > 0) return output[jsKeys[0]!] ?? null;
  return null;
};

const runCompile = (props: IRunOptions): Promise<ICompilerService.IResult> =>
  enqueue(() => buildWithTypia(props, projectFiles));

const runBundle = (props: IRunOptions): Promise<ICompilerService.IResult> =>
  enqueue(() => buildWithTypia(props, projectFilesForBundle));

// Both the "Compiled JS" preview and the Execute sandbox share the same
// transform-then-build pipeline. They only differ in tsconfig: ESM for the
// preview, CommonJS for Execute (whose sandbox driver needs CJS).
//
// `runBundle` used to call `runCompileImpl` after writing the transformed
// source back to MemFS — which silently re-wrote the original (untransformed)
// source AND swapped the tsconfig back to ESM. That meant Execute was
// running un-typia'd ESM through a CJS-shaped harness. Unifying both paths
// here keeps the typia output visible in the preview and actually run by
// Execute.
const buildWithTypia = async (
  props: IRunOptions,
  files: (source: string) => Record<string, string>,
): Promise<ICompilerService.IResult> => {
  try {
    const { api, host } = await getBoot();
    writeProject(host, files(props.source));
    if (props.options?.typia !== false) {
      await applyTypiaTransform(api, host);
    }
    const raw = await api.build({ cwd: WORK_DIR, tsconfig: TSCONFIG_PATH });
    if (raw.code !== 0 && !raw.result) {
      return {
        type: "error",
        target: "javascript",
        value: {
          message: raw.stderr || "ttsc: build failed without a result payload",
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
      mapDiagnostic(d, props.source),
    );
    const js = pickEmittedJS(parsed.output ?? {});
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

// Run typia's source-to-source transform across the project and write the
// rewritten TS back into MemFS so the subsequent `api.build` sees it.
//
// Returns the plugin's stderr so the caller can surface typia errors in the
// diagnostics stream when the transform refused to rewrite (e.g. unsupported
// method). Throw-class errors (plugin spawn / JSON parse) are still swallowed
// so the user always gets at least the tsgo compile diagnostics back.
const applyTypiaTransform = async (
  api: IBootResult["api"],
  host: IBootResult["host"],
): Promise<{ stderr: string } | null> => {
  try {
    const transformRaw = await api.plugin({
      name: "typia",
      command: "transform",
      cwd: WORK_DIR,
      tsconfig: TSCONFIG_PATH,
      output: "ts",
    });
    if (!transformRaw.stdout) {
      return { stderr: transformRaw.stderr ?? "" };
    }
    const transformed = safeParseTypiaTransform(transformRaw.stdout);
    if (!transformed) return { stderr: transformRaw.stderr ?? "" };
    for (const [rel, text] of Object.entries(transformed.typescript)) {
      host.writeFile(joinUnder(WORK_DIR, rel), text);
    }
    return { stderr: transformRaw.stderr ?? "" };
  } catch {
    return null;
  }
};

interface ITypiaTransformOutput {
  diagnostics?: unknown;
  typescript: Record<string, string>;
}

const safeParseTypiaTransform = (
  text: string,
): ITypiaTransformOutput | null => {
  try {
    const parsed = JSON.parse(text) as ITypiaTransformOutput;
    if (parsed && typeof parsed === "object" && parsed.typescript) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const joinUnder = (base: string, rel: string): string => {
  if (rel.startsWith("/")) return rel;
  return `${base}/${rel}`;
};

// projectFilesForBundle mirrors projectFiles but installs the CJS tsconfig
// (which also registers typia's transform so the wasm-side typia adapter
// knows to run). The CJS emit makes the result drivable from `new Function`
// on the playground side.
const projectFilesForBundle = (source: string): Record<string, string> => ({
  [`${WORK_DIR}/${TSCONFIG_PATH}`]: tsconfigCJSJSON,
  [`${WORK_DIR}/${ENTRY_FILE}`]: source,
});

const runLint = (props: IRunOptions): Promise<ICompilerService.ILintResult> =>
  enqueue(() => runLintImpl(props));

const runLintImpl = async (
  props: IRunOptions,
): Promise<ICompilerService.ILintResult> => {
  // The lint plugin (linthost.Main wired into the wasm via cmd/playground)
  // emits tsgo-style pretty diagnostics on stderr. We parse those lines back
  // into our IDiagnostic shape for the Lint tab; the playground's lint plugin
  // wrapper feeds in a default rule preset when no --plugins-json is passed,
  // so a fresh paste already lights up no-var / prefer-const / eqeqeq.
  try {
    const { api, host } = await getBoot();
    writeProject(host, projectFiles(props.source));
    const raw = await api.plugin({
      name: "@ttsc/lint",
      command: "check",
      cwd: WORK_DIR,
      tsconfig: TSCONFIG_PATH,
    });
    return { diagnostics: parseLintDiagnostics(raw.stderr, props.source) };
  } catch (error) {
    return { diagnostics: [] };
  }
};

// parseLintDiagnostics scans the lint plugin's stderr for the `file:line:col -
// severity TS<code>: [rule-name] message` tuples tsgo's pretty renderer emits.
// Ansi color escapes are stripped before parsing so the output matches what
// the user sees rendered in the Lint tab.
const LINT_LINE_REGEXP =
  /([^\s:]+):(\d+):(\d+)\s+-\s+(error|warning)\s+TS(\d+):\s+(?:\[([^\]]+)\]\s+)?(.*)$/;
const ANSI_REGEXP = /\[[0-9;]*m/g;

const parseLintDiagnostics = (
  stderr: string,
  source: string,
): ICompilerService.IDiagnostic[] => {
  const stripped = stderr.replace(ANSI_REGEXP, "");
  const lines = stripped.split(/\r?\n/);
  const out: ICompilerService.IDiagnostic[] = [];
  for (const line of lines) {
    const m = line.match(LINT_LINE_REGEXP);
    if (!m) continue;
    const [, , lineStr, colStr, sev, codeStr, rule, message] = m;
    const lineNum = Number(lineStr);
    const colNum = Number(colStr);
    if (!Number.isFinite(lineNum) || !Number.isFinite(colNum)) continue;
    out.push({
      line: lineNum,
      column: colNum,
      length: lengthOfTokenAt(source, lineNum, colNum) ?? 1,
      severity: sev === "warning" ? "warning" : "error",
      message: rule ? `[${rule}] ${message}` : message,
      code: `TS${codeStr}`,
    });
  }
  return out;
};

const lengthOfTokenAt = (
  source: string,
  line: number,
  column: number,
): number | null => {
  const lines = source.split(/\r?\n/);
  if (line < 1 || line > lines.length) return null;
  const text = lines[line - 1] ?? "";
  const start = Math.max(0, column - 1);
  const match = text.slice(start).match(/^[\w$]+/);
  if (!match) return null;
  return match[0].length;
};

const normalizeError = (error: unknown): unknown => {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack };
  if (
    error &&
    typeof error === "object" &&
    "message" in (error as Record<string, unknown>)
  )
    return error;
  return { name: "Error", message: String(error) };
};

const main = async (): Promise<void> => {
  const worker = new WorkerServer();
  const provider: ICompilerService = {
    installDependencies,
    compile: runCompile,
    bundle: runBundle,
    lint: runLint,
  };
  await worker.open(provider);
};

void main();
