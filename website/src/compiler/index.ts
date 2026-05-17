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

import { WorkerServer } from "tgrid";
import {
  bootTtsc,
  parseResult,
  type IBootResult,
  type ITtscCompileResult,
} from "@ttsc/wasm";

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

const tsconfigJSON = JSON.stringify({
  compilerOptions: {
    target: "ESNext",
    module: "ESNext",
    moduleResolution: "Bundler",
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    skipLibCheck: true,
    experimentalDecorators: true,
    outDir: "dist",
    rootDir: "src",
  },
  include: ["src"],
});

// projectFilesForBundle's tsconfig is identical except `module: "CommonJS"`
// so the emitted JS uses `require`/`exports`/`module.exports` — which the
// playground's `new Function("require, module, exports, console", code)`
// sandbox can drive without an ESM loader.
const tsconfigCJSJSON = JSON.stringify({
  compilerOptions: {
    target: "ESNext",
    module: "CommonJS",
    moduleResolution: "Bundler",
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    skipLibCheck: true,
    experimentalDecorators: true,
    outDir: "dist",
    rootDir: "src",
    plugins: [{ transform: "typia/lib/transform" }],
  },
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

const lineColumnOf = (
  source: string,
  start: number | undefined,
): { line: number; column: number } => {
  if (typeof start !== "number" || start < 0)
    return { line: 1, column: 1 };
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

const pickEmittedJS = (
  output: Record<string, string>,
): string | null => {
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
  enqueue(() => runCompileImpl(props));

const runCompileImpl = async (
  props: IRunOptions,
): Promise<ICompilerService.IResult> => {
  try {
    const { api, host } = await getBoot();
    writeProject(host, projectFiles(props.source));
    const raw = await api.build({ cwd: WORK_DIR, tsconfig: TSCONFIG_PATH });
    if (raw.code !== 0 && !raw.result) {
      return {
        type: "error",
        target: "javascript",
        value: { message: raw.stderr || "ttsc: build failed without a result payload" },
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

const runBundle = (props: IRunOptions): Promise<ICompilerService.IResult> =>
  enqueue(() => runBundleImpl(props));

const runBundleImpl = async (
  props: IRunOptions,
): Promise<ICompilerService.IResult> => {
  // "bundle" runs typia's transform across the project, rewrites the source
  // files back into MemFS, then runs a CJS build so the emitted JS uses
  // require/exports — which `new Function("require, module, exports,
  // console", code)` can drive without an ESM loader. If typia produces no
  // rewrite (the user didn't use `typia.is`/`typia.assert`/...) we still
  // emit CJS so the Execute path is consistent.
  try {
    const { api, host } = await getBoot();
    writeProject(host, projectFilesForBundle(props.source));
    const transformRaw = await api.plugin({
      name: "typia",
      command: "transform",
      cwd: WORK_DIR,
      tsconfig: TSCONFIG_PATH,
      output: "ts",
    });
    if (transformRaw.code === 0 && transformRaw.stdout) {
      const transformed = safeParseTypiaTransform(transformRaw.stdout);
      if (transformed) {
        for (const [rel, text] of Object.entries(transformed.typescript)) {
          host.writeFile(joinUnder(WORK_DIR, rel), text);
        }
      }
    }
  } catch {
    // fall through — the user still sees compile diagnostics
  }
  return runCompileImpl(props);
};

interface ITypiaTransformOutput {
  diagnostics?: unknown;
  typescript: Record<string, string>;
}

const safeParseTypiaTransform = (text: string): ITypiaTransformOutput | null => {
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

const runLint = (
  props: IRunOptions,
): Promise<ICompilerService.ILintResult> =>
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
    compile: runCompile,
    bundle: runBundle,
    lint: runLint,
  };
  await worker.open(provider);
};

void main();
