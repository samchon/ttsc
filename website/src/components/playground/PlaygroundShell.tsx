"use client";

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkerConnector } from "tgrid";

import type { ICompilerService } from "../../compiler/ICompilerService";
import type { ITransformOptions } from "../../compiler/ITransformOptions";
import {
  PLAYGROUND_DEFAULT_SCRIPT,
  PLAYGROUND_EXAMPLES,
} from "../../compiler/PlaygroundExamples";
import ConsoleViewer, { type IConsoleMessage } from "./ConsoleViewer";
import DiagnosticsPanel from "./DiagnosticsPanel";
import ExamplePicker from "./ExamplePicker";
import OptionsPanel from "./OptionsPanel";
import ResultViewer from "./ResultViewer";
import SourceEditor from "./SourceEditor";

// The compiler runs in a Web Worker bundled separately by rspack (see
// `rspack.config.js` and `build/compiler.cjs`). We talk to it through tgrid's
// `WorkerConnector`, which gives us a typed RPC driver matching
// `ICompilerService`. The worker URL is relative to the site root so static
// export resolves it from `out/compiler/index.js`.
//
// We hand-roll the singleton (instead of using `tstl`'s `Singleton`) so a
// boot failure clears the cached promise. Otherwise every retry would resolve
// to the same rejection.
type CompilerService = ICompilerService;
let compilerServicePromise: Promise<CompilerService> | null = null;
function createCompilerService(): Promise<CompilerService> {
  if (compilerServicePromise) return compilerServicePromise;
  compilerServicePromise = (async () => {
    const connector = new WorkerConnector(null, null);
    try {
      await connector.connect("/compiler/index.js");
    } catch (err) {
      // Clear the cached promise so the next call retries instead of
      // resolving to the rejection forever.
      compilerServicePromise = null;
      throw err;
    }
    return connector.getDriver<CompilerService>();
  })();
  return compilerServicePromise;
}

type Target = "javascript" | "lint";

const DEFAULT_OPTIONS: ITransformOptions = {
  typia: true,
  lint: true,
};

// Cap the share URL at roughly the lowest-common-denominator browser limit
// (~2KB). lz-string compresses well but pathological inputs blow past this.
const SHARE_URL_WARN_BYTES = 2000;

export default function PlaygroundShell() {
  const [source, setSource] = useState<string>(PLAYGROUND_DEFAULT_SCRIPT);
  const [target, setTarget] = useState<Target>("javascript");
  const [options, setOptions] = useState<ITransformOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ICompilerService.IResult | null>(null);
  const [lintDiagnostics, setLintDiagnostics] = useState<
    ICompilerService.IDiagnostic[]
  >([]);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [consoleMessages, setConsoleMessages] = useState<IConsoleMessage[]>([]);
  const [executing, setExecuting] = useState(false);
  const [bootError, setBootError] = useState<unknown>(null);
  const [bootPhase, setBootPhase] = useState<"booting" | "ready" | "failed">(
    "booting",
  );
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [shareWarn, setShareWarn] = useState<string | null>(null);
  const [sourceFromURL, setSourceFromURL] = useState(false);
  const debounce = useRef<number | null>(null);
  const shareToastTimer = useRef<number | null>(null);
  // Race guard: every `run` call bumps this epoch; only the call whose epoch
  // matches the latest at completion time wins the state update. Otherwise a
  // slow keystroke-N compile can overwrite a faster keystroke-N+1 result.
  const runEpoch = useRef(0);

  // ── Decode source from URL on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("script");
    if (encoded) {
      const decoded = decompressFromEncodedURIComponent(encoded);
      if (decoded) {
        setSource(decoded);
        setSourceFromURL(true);
      }
    }
  }, []);

  // ── Eagerly boot the worker so first compile is instant ──
  useEffect(() => {
    let cancelled = false;
    setBootPhase("booting");
    createCompilerService().then(
      () => {
        if (!cancelled) setBootPhase("ready");
      },
      (err: unknown) => {
        if (!cancelled) {
          setBootError(err);
          setBootPhase("failed");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Run compile when source / target / options change ──
  const run = useCallback(
    async (input: string, mode: Target, opts: ITransformOptions) => {
      const epoch = ++runEpoch.current;
      setRunning(true);
      try {
        // Every diagnostic — type errors and lint findings — comes back
        // through the same worker-driven compile. We surface lint-only
        // diagnostics in the "Lint" tab and full diagnostics in the
        // playground footer.
        const service = await createCompilerService();
        const next = await service.compile({ source: input, options: opts });
        if (runEpoch.current !== epoch) return;
        setResult(next);
        const lint = await service.lint({ source: input, options: opts });
        if (runEpoch.current !== epoch) return;
        setLintDiagnostics(lint.diagnostics);
        // mode is reserved for future "transform only" / "lint only" routes;
        // the worker currently always returns the compile result.
        void mode;
      } catch (err) {
        if (runEpoch.current !== epoch) return;
        setBootError(err);
        setBootPhase("failed");
      } finally {
        if (runEpoch.current === epoch) setRunning(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (bootPhase !== "ready") return;
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      void run(source, target, options);
    }, 280);
    return () => {
      if (debounce.current !== null) window.clearTimeout(debounce.current);
    };
  }, [source, target, options, run, bootPhase]);

  const onShare = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("script", compressToEncodedURIComponent(source));
    const urlString = url.toString();
    void navigator.clipboard.writeText(urlString);
    window.history.replaceState(null, "", urlString);
    setShareToast(true);
    if (shareToastTimer.current !== null)
      window.clearTimeout(shareToastTimer.current);
    shareToastTimer.current = window.setTimeout(() => {
      setShareToast(false);
      shareToastTimer.current = null;
    }, 1800);
    if (urlString.length > SHARE_URL_WARN_BYTES) {
      setShareWarn(
        `Share URL is ${urlString.length} bytes — some browsers truncate URLs past ~2KB. Consider sharing as a Gist instead.`,
      );
    } else {
      setShareWarn(null);
    }
  }, [source]);

  // Cleanup share-toast timer on unmount so an in-flight setTimeout doesn't
  // call setState after the component is gone.
  useEffect(
    () => () => {
      if (shareToastTimer.current !== null)
        window.clearTimeout(shareToastTimer.current);
    },
    [],
  );

  const onPickExample = useCallback((id: string) => {
    const example = PLAYGROUND_EXAMPLES.find((e) => e.id === id);
    if (example) {
      setSource(example.source);
      setSourceFromURL(false);
    }
  }, []);

  const onReset = useCallback(() => {
    setSource(PLAYGROUND_DEFAULT_SCRIPT);
    setSourceFromURL(false);
  }, []);

  const onExecute = useCallback(async () => {
    setExecuting(true);
    setBundleError(null);
    const messages: IConsoleMessage[] = [];
    const push = (type: IConsoleMessage["type"], args: unknown[]) => {
      messages.push({ type, value: args });
      setConsoleMessages([...messages]);
    };
    try {
      // Bundle the source through the worker. `service.bundle` runs the typia
      // TS transformer over the user's code, then asks the wasm to emit CJS.
      // The worker wraps the emit in `(function(require, module, exports,
      // console) { ... })` and a sandbox `require` resolves from MemFS first.
      const service = await createCompilerService();
      const compiled = await service.bundle({ source, options });
      if (compiled.type === "error") {
        const message =
          typeof compiled.value === "string"
            ? compiled.value
            : (compiled.value as { message?: string })?.message ??
              "Bundle failed";
        setBundleError(message);
        push("error", [compiled.value]);
        return;
      }
      const code = compiled.value as string;
      const sandboxConsole = {
        log: (...args: unknown[]) => push("log", args),
        info: (...args: unknown[]) => push("info", args),
        warn: (...args: unknown[]) => push("warn", args),
        error: (...args: unknown[]) => push("error", args),
        debug: (...args: unknown[]) => push("debug", args),
        dir: (...args: unknown[]) => push("dir", args),
        table: (...args: unknown[]) => push("table", args),
      };
      // The worker emits CommonJS, so the bundled output uses `require(...)`,
      // `exports`, and `module.exports`. We wrap it in a function whose
      // parameters supply each of those, plus a `stubRequire` that resolves
      // typia from the playground bundle (loaded asynchronously) and throws
      // for anything else so the user sees the unsupported dependency.
      const stubRequire = (specifier: string): unknown => {
        throw new Error(
          `require("${specifier}") is not available in the playground sandbox`,
        );
      };
      const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
      try {
        const wrapped = `(function(require, module, exports, console) {\n${code}\n})`;
        const factory = new Function("return " + wrapped)() as (
          req: (s: string) => unknown,
          mod: typeof moduleObj,
          exp: typeof moduleObj.exports,
          c: typeof sandboxConsole,
        ) => void;
        factory(stubRequire, moduleObj, moduleObj.exports, sandboxConsole);
      } catch (error) {
        push("error", [error]);
      }
    } catch (error) {
      push("error", [error]);
    } finally {
      setExecuting(false);
    }
  }, [source, options]);

  const allDiagnostics = useMemo(() => {
    const fromCompile =
      result && result.type === "failure" ? result.diagnostics : [];
    const set = new Set<string>();
    return [...fromCompile, ...lintDiagnostics].filter((d) => {
      const key = `${d.line}:${d.column}:${d.code ?? ""}:${d.message}`;
      if (set.has(key)) return false;
      set.add(key);
      return true;
    });
  }, [result, lintDiagnostics]);

  // ── Keyboard accelerators ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        void onExecute();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        onShare();
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Surface the examples menu; ExamplePicker watches its own state, so
        // toggle by simulating a click on its button.
        document
          .querySelector<HTMLButtonElement>(
            "button[data-playground-examples-toggle]",
          )
          ?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExecute, onShare]);

  // ── Boot error card ──
  if (bootPhase === "failed") {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center bg-neutral-950 text-neutral-200 gap-5 px-6 text-center">
        <span className="text-red-400 text-3xl">⚠</span>
        <h1 className="text-lg font-mono">
          Playground failed to boot.
        </h1>
        <pre className="max-w-xl text-[12px] font-mono text-neutral-400 whitespace-pre-wrap break-words">
          {(() => {
            const e = bootError;
            if (e instanceof Error) return `${e.name}: ${e.message}`;
            try {
              return JSON.stringify(e, null, 2);
            } catch {
              return String(e);
            }
          })()}
        </pre>
        <button
          onClick={() => {
            compilerServicePromise = null;
            setBootError(null);
            setBootPhase("booting");
            createCompilerService().then(
              () => setBootPhase("ready"),
              (err) => {
                setBootError(err);
                setBootPhase("failed");
              },
            );
          }}
          className="px-5 py-2 text-xs font-mono text-neutral-900 bg-white rounded-md hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  const compiledJsCaption = options.typia
    ? "dist/playground.js"
    : "dist/playground.js · typia disabled";

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-950 text-neutral-200 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/70 bg-neutral-950 shrink-0">
        <a
          href="/"
          className="font-mono text-sm font-bold text-white hover:text-blue-400 transition-colors"
        >
          ttsc
        </a>
        <span className="text-neutral-700">/</span>
        <span className="text-sm text-neutral-400">Playground</span>

        <div className="ml-auto flex items-center gap-2">
          <ExamplePicker onPick={onPickExample} />
          <button
            onClick={() => setOptionsOpen((v) => !v)}
            className="px-3 py-1.5 text-xs font-mono text-neutral-300 border border-neutral-800 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition-colors"
          >
            Options
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Reset
          </button>
          <button
            onClick={onShare}
            className="px-3 py-1.5 text-xs font-mono text-neutral-900 bg-white rounded-md hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-shadow"
          >
            {shareToast ? "Copied ✓" : "Share"}
          </button>
        </div>
      </div>

      {/* ── Source-from-URL banner ── */}
      {sourceFromURL && (
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-amber-200 bg-amber-500/10 border-b border-amber-700/40">
          Source loaded from share URL. Hit Reset to return to the default example.
        </div>
      )}

      {/* ── Share-URL length warning ── */}
      {shareWarn && (
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-amber-200 bg-amber-500/10 border-b border-amber-700/40">
          {shareWarn}
        </div>
      )}

      {/* ── Mode tabs ── */}
      <div className="flex items-center gap-0 border-b border-neutral-800/70 bg-neutral-950 shrink-0">
        {(
          [
            { id: "javascript", label: "Compiled JS" },
            { id: "lint", label: "Lint" },
          ] as { id: Target; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTarget(tab.id)}
            className={`px-4 py-2 text-[12px] font-mono border-b-2 transition-colors ${
              target === tab.id
                ? "text-white border-blue-400"
                : "text-neutral-500 border-transparent hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto px-4 text-[10px] font-mono text-neutral-600">
          {bootPhase === "booting"
            ? "booting wasm…"
            : running
              ? "compiling…"
              : "ready"}
        </div>
      </div>

      {/* ── Main split (editor / output) ── */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex-1 min-w-0 md:border-r border-neutral-800/70 flex flex-col h-1/2 md:h-full">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800/70 bg-neutral-950">
            <span className="text-[11px] font-mono text-neutral-500">
              src/playground.ts
            </span>
            <span className="text-[10px] font-mono text-neutral-700">
              {source.split("\n").length} lines
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <SourceEditor value={source} onChange={setSource} />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col h-1/2 md:h-full border-t md:border-t-0 border-neutral-800/70">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800/70 bg-neutral-950">
            <span className="text-[11px] font-mono text-neutral-500">
              {target === "javascript" ? compiledJsCaption : "lint diagnostics"}
            </span>
            <span className="text-[10px] font-mono text-neutral-700">
              {result?.type === "error" ? "error" : ""}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            {target === "lint" ? (
              <LintOnlyPane diagnostics={lintDiagnostics} />
            ) : (
              <ResultViewer
                language={result?.type === "error" ? "json" : "javascript"}
                value={
                  result === null
                    ? ""
                    : result.type === "error"
                      ? JSON.stringify(result.value, null, 2)
                      : result.value
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Bundle-step error banner ── */}
      {bundleError && (
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-red-300 bg-red-500/10 border-t border-red-700/40">
          Bundle failed — {bundleError}
        </div>
      )}

      {/* ── Execute / Console panel ── */}
      <div className="shrink-0 border-t border-neutral-800/70 bg-neutral-950 flex flex-col h-48">
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800/70">
          <span className="text-[11px] font-mono text-neutral-500">
            console output
          </span>
          <div className="flex items-center gap-2">
            {consoleMessages.length > 0 && (
              <button
                onClick={() => setConsoleMessages([])}
                className="px-2 py-1 text-[10px] font-mono text-neutral-500 hover:text-neutral-200 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={onExecute}
              disabled={executing}
              className="px-3 py-1 text-[11px] font-mono text-neutral-900 bg-emerald-400 rounded-md hover:bg-emerald-300 transition-colors disabled:opacity-50"
              title="Cmd/Ctrl+Enter"
            >
              ▶ {executing ? "Executing…" : "Execute"}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <ConsoleViewer messages={consoleMessages} />
        </div>
      </div>

      {/* ── Diagnostics drawer ── */}
      <DiagnosticsPanel diagnostics={allDiagnostics} />

      {/* ── Options modal ── */}
      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={setOptions}
          onClose={() => setOptionsOpen(false)}
        />
      )}
    </div>
  );
}

function LintOnlyPane({
  diagnostics,
}: {
  diagnostics: ICompilerService.IDiagnostic[];
}) {
  if (diagnostics.length === 0)
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-500 font-mono text-sm gap-2">
        <span className="text-emerald-400 text-xl">✓</span>
        <span>No lint diagnostics.</span>
        <span className="text-[10px] text-neutral-600 max-w-xs text-center">
          Powered by @ttsc/lint inside playground.wasm.
        </span>
      </div>
    );
  return (
    <div className="overflow-auto h-full p-4 space-y-2">
      {diagnostics.map((d, i) => (
        <div
          key={i}
          className="flex gap-3 p-3 rounded-md bg-neutral-900/60 border border-neutral-800/80"
        >
          <span
            className={`mt-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
              d.severity === "error"
                ? "text-red-300 bg-red-500/10"
                : "text-yellow-300 bg-yellow-500/10"
            }`}
          >
            {d.severity}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500 mb-1">
              <span>{d.code}</span>
              <span>·</span>
              <span>
                {d.line}:{d.column}
              </span>
            </div>
            <div className="text-[13px] text-neutral-200 font-mono">
              {d.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
