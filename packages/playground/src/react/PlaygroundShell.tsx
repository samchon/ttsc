"use client";

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { normalizeError } from "../compiler/normalizeError";
import { BUILT_IN_PLAYGROUND_PACKAGES } from "../npm/BUILT_IN_PLAYGROUND_PACKAGES";
import { collectExternalPackageNames } from "../npm/collectExternalPackageNames";
import { installPlaygroundDependencies } from "../npm/installPlaygroundDependencies";
import type { ICompilerService } from "../structures/ICompilerService";
import type { IConsoleMessage } from "../structures/IConsoleMessage";
import type { IPlaygroundDependencyProgress } from "../structures/IPlaygroundDependencyProgress";
import type { IPlaygroundInstalledDependency } from "../structures/IPlaygroundInstalledDependency";
import type { IPlaygroundShellProps } from "../structures/IPlaygroundShellProps";
import type { ITransformOptions } from "../structures/ITransformOptions";
import { ConsoleViewer } from "./ConsoleViewer";
import { DEFAULT_OPTION_TOGGLES } from "./DEFAULT_OPTION_TOGGLES";
import { DependencyProgressModal } from "./DependencyProgressModal";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ExamplePicker } from "./ExamplePicker";
import { LintPane } from "./LintPane";
import { OptionsPanel } from "./OptionsPanel";
import { ResultViewer } from "./ResultViewer";
import { SourceEditor } from "./SourceEditor";
import { createCompilerClient } from "./createCompilerClient";
import {
  type IPlaygroundCompilerGeneration,
  PlaygroundCompilerLifecycle,
} from "./internal/PlaygroundCompilerLifecycle";
import { PlaygroundExecutionLifecycle } from "./internal/PlaygroundExecutionLifecycle";
import { recoverTerminalCompilerWorker } from "./internal/recoverTerminalCompilerWorker";

const DEFAULT_OPTIONS: ITransformOptions = {
  typia: true,
  lint: true,
};

const DEPENDENCY_INSTALL_QUIET_MS = 900;
const SHARE_URL_WARN_BYTES = 2000;

type Tab = "javascript" | "lint";

export function PlaygroundShell({
  workerUrl,
  defaultScript,
  examples = [],
  exampleGroupLabels,
  optionToggles = DEFAULT_OPTION_TOGGLES,
  defaultOptions = DEFAULT_OPTIONS,
  staticEditorLibs,
  preinstalledPackages = BUILT_IN_PLAYGROUND_PACKAGES,
  executeBundle,
  brand,
  resultCaption = defaultResultCaption,
}: IPlaygroundShellProps) {
  const client = useMemo(
    () => createCompilerClient({ workerUrl }),
    [workerUrl],
  );
  const createCompilerService = client.connect;

  const [source, setSource] = useState<string>(defaultScript);
  const [target, setTarget] = useState<Tab>("javascript");
  const [options, setOptions] = useState<ITransformOptions>(defaultOptions);
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
  const [editorExtraLibs, setEditorExtraLibs] = useState<
    Record<string, string>
  >({});
  const [dependencyProgress, setDependencyProgress] =
    useState<IPlaygroundDependencyProgress | null>(null);
  const [dependencyPackageNames, setDependencyPackageNames] = useState<
    string[]
  >([]);
  const debounce = useRef<number | null>(null);
  const shareToastTimer = useRef<number | null>(null);
  const dependencyProgressTimer = useRef<number | null>(null);
  const dependencyAbort = useRef<AbortController | null>(null);
  const compilerLifecycle = useRef(new PlaygroundCompilerLifecycle());
  const executionLifecycle = useRef(new PlaygroundExecutionLifecycle());
  // Exact mounted identities and active requests. A name-only set cannot
  // validate a later transitive range or distinguish an npm alias target.
  const installedDependencies = useRef<
    Map<string, IPlaygroundInstalledDependency>
  >(new Map());
  // Direct source roots selecting the mounted graph. Removing one requires a
  // full solve and worker replacement so obsolete package files cannot survive.
  const dependencyRoots = useRef<Set<string>>(new Set());
  // Accumulated runtime-file map produced by every successful
  // installPlaygroundDependencies call. Threaded through to executeBundle so
  // the in-page Execute sandbox's require can resolve any npm package the
  // user installed (without it, `import {v4} from "uuid"` compiles fine but
  // Execute throws because the worker mounts uuid into the wasm MemFS only).
  const runtimeDependencyFiles = useRef<Record<string, string>>({});
  const sourceVersion = useRef(0);
  const latestSource = useRef(source);
  // Compile/run uses an epoch, while Execute uses an abortable lifecycle.
  // The boundaries stay separate so starting Execute does not invalidate an
  // in-flight compile. Source and option changes explicitly invalidate both
  // pipelines because either makes an older result obsolete.
  const compileEpoch = useRef(0);

  const mergedExtraLibs = useMemo(
    () => ({ ...staticEditorLibs, ...editorExtraLibs }),
    [staticEditorLibs, editorExtraLibs],
  );

  const invalidateCompilerGeneration = useCallback(
    (
      reason: string,
      expected?: IPlaygroundCompilerGeneration,
      publishState: boolean = true,
    ): IPlaygroundCompilerGeneration | undefined => {
      const replacement =
        expected === undefined
          ? compilerLifecycle.current.invalidate()
          : compilerLifecycle.current.invalidateIfCurrent(expected);
      if (replacement === undefined) return undefined;

      compileEpoch.current++;
      executionLifecycle.current.invalidate(reason);
      const abort = dependencyAbort.current;
      dependencyAbort.current = null;
      abort?.abort(createAbortError(reason));
      if (dependencyProgressTimer.current !== null) {
        window.clearTimeout(dependencyProgressTimer.current);
        dependencyProgressTimer.current = null;
      }
      installedDependencies.current = new Map();
      dependencyRoots.current = new Set();
      runtimeDependencyFiles.current = {};
      if (publishState) {
        setEditorExtraLibs({});
        setDependencyProgress(null);
        setDependencyPackageNames([]);
        setRunning(false);
        setExecuting(false);
        setBundleError(null);
        setBootError(null);
        setBootPhase("booting");
      }
      return replacement;
    },
    [],
  );

  const recoverTerminalWorker = useCallback(
    (
      error: unknown,
      generation: IPlaygroundCompilerGeneration,
    ): Promise<boolean> => {
      let replacement: IPlaygroundCompilerGeneration | undefined;
      return recoverTerminalCompilerWorker(error, {
        claim: () => {
          replacement = invalidateCompilerGeneration(
            "compiler Worker replacement required",
            generation,
          );
          return replacement !== undefined;
        },
        reset: client.reset,
        fail: (terminalError) => {
          if (replacement?.isCurrent() !== true) return;
          setBootError(terminalError);
          setBootPhase("failed");
        },
      });
    },
    [client, invalidateCompilerGeneration],
  );

  const updateSource = useCallback((next: string) => {
    sourceVersion.current++;
    latestSource.current = next;
    // Typing invalidates both the compile result and any click-driven Execute.
    compileEpoch.current++;
    executionLifecycle.current.invalidate("source changed");
    dependencyAbort.current?.abort(createAbortError("source changed"));
    setExecuting(false);
    setDependencyProgress(null);
    setDependencyPackageNames([]);
    setSource(next);
  }, []);

  const updateOptions = useCallback((next: ITransformOptions) => {
    compileEpoch.current++;
    executionLifecycle.current.invalidate("compiler options changed");
    setExecuting(false);
    setOptions(next);
  }, []);

  // ── Decode source from URL on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("script");
    if (encoded) {
      const decoded = decompressFromEncodedURIComponent(encoded);
      if (decoded) {
        updateSource(decoded);
        setSourceFromURL(true);
      }
    }
  }, [updateSource]);

  // Establish a generation boundary before any boot work starts. Cleanup
  // fences every callback that captured the old client before resetting it.
  useEffect(() => {
    invalidateCompilerGeneration("compiler client changed");
    return () => {
      // Internal recovery may have replaced the generation captured at setup,
      // but every such replacement still belongs to this client.
      invalidateCompilerGeneration(
        "compiler client disposed",
        undefined,
        false,
      );
      void client.reset();
    };
  }, [client, invalidateCompilerGeneration]);

  // ── Eagerly boot the worker so first compile is instant ──
  useEffect(() => {
    let cancelled = false;
    const generation = compilerLifecycle.current.capture();
    setBootPhase("booting");
    createCompilerService().then(
      () => {
        if (!cancelled && generation.isCurrent()) setBootPhase("ready");
      },
      (err: unknown) => {
        if (!cancelled && generation.isCurrent()) {
          setBootError(err);
          setBootPhase("failed");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [createCompilerService]);

  const installDependenciesForSource = useCallback(
    async (
      input: string,
      version: number = sourceVersion.current,
    ): Promise<unknown | null> => {
      const result = await compilerLifecycle.current.enqueue(
        async (generation): Promise<unknown | null> => {
          const isCurrent = (): boolean =>
            generation.isCurrent() && sourceVersion.current === version;
          if (!isCurrent()) return null;

          const firstPassPackageNames = collectExternalPackageNames(
            input,
            preinstalledPackages,
          );
          if (
            dependencyRootDelta(firstPassPackageNames, dependencyRoots.current)
              .changed === false
          )
            return null;

          await wait(DEPENDENCY_INSTALL_QUIET_MS);
          if (!isCurrent()) return null;

          const packageNames = collectExternalPackageNames(
            latestSource.current,
            preinstalledPackages,
          );
          const delta = dependencyRootDelta(
            packageNames,
            dependencyRoots.current,
          );
          if (!delta.changed) return null;
          const replacing = delta.removed.length !== 0;
          const requested = replacing ? packageNames : delta.added;

          if (dependencyProgressTimer.current !== null) {
            window.clearTimeout(dependencyProgressTimer.current);
            dependencyProgressTimer.current = null;
          }
          if (!isCurrent()) return null;
          setDependencyPackageNames(requested);
          const abort = new AbortController();
          dependencyAbort.current = abort;
          let workerMutated = false;
          try {
            const installed = await installPlaygroundDependencies(requested, {
              installedDependencies: replacing
                ? []
                : installedDependencies.current.values(),
              ignoredPackages: preinstalledPackages,
              signal: abort.signal,
              onProgress: (progress) => {
                if (isCurrent()) setDependencyProgress(progress);
              },
            });
            if (!isCurrent()) return null;

            if (replacing) {
              workerMutated = true;
              await client.reset();
              if (!isCurrent()) return null;
              installedDependencies.current = new Map();
              dependencyRoots.current = new Set();
              runtimeDependencyFiles.current = {};
              setEditorExtraLibs({});
            }
            if (Object.keys(installed.compilerFiles).length > 0) {
              if (!isCurrent()) return null;
              const service = await createCompilerService();
              if (!isCurrent()) return null;
              workerMutated = true;
              await service.installDependencies({
                files: installed.compilerFiles,
                packages: installed.packages.map(({ name, version }) => ({
                  name,
                  version,
                })),
              });
              if (!isCurrent()) return null;
            }
            installedDependencies.current = new Map(
              installed.resolvedDependencies.map(
                (dependency) => [dependency.name, dependency] as const,
              ),
            );
            dependencyRoots.current = new Set(packageNames);
            setEditorExtraLibs((previous) =>
              replacing
                ? installed.editorLibs
                : { ...previous, ...installed.editorLibs },
            );
            runtimeDependencyFiles.current = replacing
              ? installed.runtimeFiles
              : {
                  ...runtimeDependencyFiles.current,
                  ...installed.runtimeFiles,
                };
            const progressTimer = window.setTimeout(() => {
              if (
                dependencyProgressTimer.current === progressTimer &&
                generation.isCurrent()
              ) {
                setDependencyProgress(null);
                setDependencyPackageNames([]);
                dependencyProgressTimer.current = null;
              }
            }, 350);
            dependencyProgressTimer.current = progressTimer;
            return null;
          } catch (error) {
            if (!generation.isCurrent()) return null;
            if (workerMutated) {
              await client.reset();
              if (!generation.isCurrent()) return null;
              installedDependencies.current = new Map();
              dependencyRoots.current = new Set();
              runtimeDependencyFiles.current = {};
              setEditorExtraLibs({});
            }
            if (!isCurrent()) return null;
            if (isAbortError(error)) {
              setDependencyProgress(null);
              setDependencyPackageNames([]);
              return null;
            }
            setDependencyProgress({
              phase: "error",
              packageName: requested[0],
              completed: 0,
              total: requested.length,
              message: describeUnknownError(error),
            });
            const progressTimer = window.setTimeout(() => {
              if (
                dependencyProgressTimer.current === progressTimer &&
                generation.isCurrent()
              ) {
                setDependencyProgress(null);
                setDependencyPackageNames([]);
                dependencyProgressTimer.current = null;
              }
            }, 2400);
            dependencyProgressTimer.current = progressTimer;
            return error;
          } finally {
            if (dependencyAbort.current === abort)
              dependencyAbort.current = null;
          }
        },
      );
      return result ?? null;
    },
    [client, createCompilerService, preinstalledPackages],
  );

  // ── Run compile when source / options change ──
  //
  // `target` (the active tab) is intentionally NOT a trigger here: the
  // compile produces the same result + lintDiagnostics regardless of
  // which tab the user is looking at; the tab choice only swaps which
  // pane is rendered. Re-running the wasm-heavy pipeline on every tab
  // click would burn multiple seconds of work per click.
  const run = useCallback(
    async (input: string, opts: ITransformOptions, version: number) => {
      const epoch = ++compileEpoch.current;
      const generation = compilerLifecycle.current.capture();
      setRunning(true);
      try {
        const dependencyError = await installDependenciesForSource(
          input,
          version,
        );
        if (compileEpoch.current !== epoch || !generation.isCurrent()) return;
        if (dependencyError) {
          if (await recoverTerminalWorker(dependencyError, generation)) return;
          setResult({
            type: "error",
            target: "javascript",
            value: normalizeError(dependencyError),
          });
          // Keep prior lintDiagnostics intact — a dependency-install blip
          // shouldn't wipe the user's most recent successful lint output.
          return;
        }
        const service = await createCompilerService();
        if (compileEpoch.current !== epoch || !generation.isCurrent()) return;
        const next = await service.compile({
          source: input,
          options: opts,
        });
        if (compileEpoch.current !== epoch || !generation.isCurrent()) return;
        if (
          next.type === "error" &&
          (await recoverTerminalWorker(next.value, generation))
        )
          return;
        setResult(next);
        if (opts.lint !== false) {
          const lint = await service.lint({ source: input, options: opts });
          if (compileEpoch.current !== epoch || !generation.isCurrent()) return;
          setLintDiagnostics(lint.diagnostics);
        } else {
          setLintDiagnostics([]);
        }
      } catch (err) {
        if (compileEpoch.current !== epoch || !generation.isCurrent()) return;
        if (await recoverTerminalWorker(err, generation)) return;
        // Surface the error in the diagnostics pane via an error result —
        // a transient compile/lint/install rejection (tgrid timeout,
        // message-channel disconnect) must NOT tear the playground into
        // the fatal boot-error screen and force a worker rebuild. Only
        // the eager boot useEffect may flip bootPhase to "failed".
        setResult({
          type: "error",
          target: "javascript",
          value: normalizeError(err),
        });
        // Leave lintDiagnostics alone — clearing them on a transient
        // compile blip would wipe the user's last good lint output.
      } finally {
        // Only the winning epoch clears the flag. Older pipelines that
        // returned early on an epoch mismatch must NOT clear running, or
        // a fresh in-flight compile would show "ready" while it's still
        // working. Execute has its own lifecycle, so it cannot stick this
        // spinner across pipeline boundaries.
        if (compileEpoch.current === epoch) setRunning(false);
      }
    },
    [
      createCompilerService,
      installDependenciesForSource,
      recoverTerminalWorker,
    ],
  );

  useEffect(() => {
    if (bootPhase !== "ready") return;
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    const version = sourceVersion.current;
    debounce.current = window.setTimeout(() => {
      void run(source, options, version);
    }, 280);
    return () => {
      if (debounce.current !== null) window.clearTimeout(debounce.current);
    };
    // `target` (the active tab) is intentionally NOT a dep — see the
    // comment on `run` above. Re-running the wasm pipeline per tab
    // click would burn seconds of work for an identical result.
  }, [source, options, run, bootPhase]);

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

  useEffect(
    () => () => {
      if (shareToastTimer.current !== null)
        window.clearTimeout(shareToastTimer.current);
      if (dependencyProgressTimer.current !== null)
        window.clearTimeout(dependencyProgressTimer.current);
      dependencyAbort.current?.abort(createAbortError("playground unmounted"));
      executionLifecycle.current.invalidate("playground unmounted");
    },
    [],
  );

  const onPickExample = useCallback(
    (id: string) => {
      const example = examples.find((e) => e.id === id);
      if (example) {
        updateSource(example.source);
        setSourceFromURL(false);
      }
    },
    [examples, updateSource],
  );

  const onReset = useCallback(() => {
    updateSource(defaultScript);
    setSourceFromURL(false);
  }, [defaultScript, updateSource]);

  const onExecute = useCallback(async () => {
    if (!executeBundle) return;
    const attempt = executionLifecycle.current.begin();
    const generation = compilerLifecycle.current.capture();
    setExecuting(true);
    setBundleError(null);
    // Clear the previous run's console output up front. Without this the
    // pane keeps showing the old logs labeled as the new run until the
    // first push fires — and an early-return bundle-error path (or an
    // install rejection) might never push at all, leaving stale output
    // attributed to the in-flight Execute.
    setConsoleMessages([]);
    const messages: IConsoleMessage[] = [];
    const push = (type: IConsoleMessage["type"], args: unknown[]) => {
      if (!attempt.isCurrent() || !generation.isCurrent()) return;
      messages.push({ type, value: args });
      setConsoleMessages([...messages]);
    };
    try {
      // Snapshot source + version atomically from the always-fresh refs.
      // Reading `source` (React state) here can be stale within a batch
      // — installDependenciesForSource would compare against the fresh
      // ref and bail, while bundle would still run against the stale
      // source so newly-needed deps stay un-mounted. latestSource is
      // updated synchronously by updateSource alongside sourceVersion.
      const currentSource = latestSource.current;
      const currentVersion = sourceVersion.current;
      const dependencyError = await installDependenciesForSource(
        currentSource,
        currentVersion,
      );
      if (!attempt.isCurrent() || !generation.isCurrent()) return;
      if (dependencyError) {
        if (await recoverTerminalWorker(dependencyError, generation)) return;
        push("error", [dependencyError]);
        return;
      }
      const service = await createCompilerService();
      if (!attempt.isCurrent() || !generation.isCurrent()) return;
      const compiled = await service.bundle({
        source: currentSource,
        options,
      });
      if (!attempt.isCurrent() || !generation.isCurrent()) return;
      if (compiled.type === "error") {
        if (await recoverTerminalWorker(compiled.value, generation)) return;
        const message =
          typeof compiled.value === "string"
            ? compiled.value
            : ((compiled.value as { message?: string })?.message ??
              "Bundle failed");
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
      try {
        await executeBundle(code, {
          console: sandboxConsole,
          runtimeFiles: runtimeDependencyFiles.current,
          signal: attempt.signal,
        });
        if (!generation.isCurrent()) return;
      } catch (error) {
        push("error", [error]);
      }
    } catch (error) {
      if (!attempt.isCurrent() || !generation.isCurrent()) return;
      if (await recoverTerminalWorker(error, generation)) return;
      push("error", [error]);
    } finally {
      if (attempt.finish()) setExecuting(false);
    }
    // `source` is intentionally NOT a dep: the body snapshots
    // `latestSource.current` (always fresh ref) rather than reading the
    // React state, so including `source` here would re-create the
    // callback per keystroke and propagate into the global keydown
    // useEffect, churning event-listener add/remove every character.
  }, [
    createCompilerService,
    executeBundle,
    installDependenciesForSource,
    options,
    recoverTerminalWorker,
  ]);

  const allDiagnostics = useMemo(() => {
    const fromCompile: ICompilerService.IDiagnostic[] = [];
    if (result?.type === "failure") {
      fromCompile.push(...result.diagnostics);
    } else if (result?.type === "error") {
      // Host-level exceptions (worker transport blip, wasm rejection)
      // surface as a synthetic diagnostic so the diagnostics strip
      // doesn't say "0 errors" while the result pane shows an error.
      const message =
        typeof result.value === "string"
          ? result.value
          : (((result.value as { message?: string })?.message ??
              "ttsc: unexpected error") as string);
      fromCompile.push({
        line: 1,
        column: 1,
        length: 1,
        severity: "error",
        message,
        code: "TTSC_RUNTIME",
      });
    }
    const set = new Set<string>();
    return [...fromCompile, ...lintDiagnostics].filter((d) => {
      const key = `${d.line}:${d.column}:${d.code ?? ""}:${d.message}`;
      if (set.has(key)) return false;
      set.add(key);
      return true;
    });
  }, [result, lintDiagnostics]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter" && executeBundle) {
        e.preventDefault();
        void onExecute();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        onShare();
      } else if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        document
          .querySelector<HTMLButtonElement>(
            "button[data-playground-examples-toggle]",
          )
          ?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [executeBundle, onExecute, onShare]);

  if (bootPhase === "failed") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-5 bg-[#f7fbff] px-6 text-center text-[#102a43]">
        <span className="text-red-400 text-3xl">⚠</span>
        <h1 className="text-lg font-mono">Playground failed to boot.</h1>
        <pre className="max-w-xl whitespace-pre-wrap break-words font-mono text-[12px] text-slate-500">
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
            const failedGeneration = compilerLifecycle.current.capture();
            const retryGeneration = invalidateCompilerGeneration(
              "compiler retry requested",
              failedGeneration,
            );
            if (retryGeneration === undefined) return;
            void (async () => {
              await client.reset();
              if (!retryGeneration.isCurrent()) return;
              try {
                await createCompilerService();
                if (!retryGeneration.isCurrent()) return;
                setBootPhase("ready");
              } catch (err) {
                if (!retryGeneration.isCurrent()) return;
                setBootError(err);
                setBootPhase("failed");
              }
            })();
          }}
          className="rounded-md bg-[#3178c6] px-5 py-2 font-mono text-xs text-white shadow-[0_8px_22px_rgba(49,120,198,0.24)] transition-colors hover:bg-[#235a97]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white text-[#102a43]">
      {sourceFromURL && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-1.5 font-mono text-[11px] text-amber-800">
          Source loaded from share URL. Hit Reset to return to the default
          example.
        </div>
      )}

      {shareWarn && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-1.5 font-mono text-[11px] text-amber-800">
          {shareWarn}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-0 border-b border-[#c7dff4] bg-white">
        {brand ? (
          <div className="flex items-center gap-2 border-r border-[#c7dff4] px-4 py-2">
            {brand}
            <span className="text-[#9db6cb]">/</span>
            <span className="text-sm text-[#526b82]">Playground</span>
          </div>
        ) : null}
        {(
          [
            { id: "javascript", label: "Compiled JS" },
            { id: "lint", label: "Lint" },
          ] as { id: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTarget(tab.id)}
            className={`px-4 py-2 text-[12px] font-mono border-b-2 transition-colors ${
              target === tab.id
                ? "border-[#3178c6] text-[#235a97]"
                : "border-transparent text-slate-400 hover:text-[#3178c6]"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex w-full items-center justify-end gap-2 border-t border-[#d8e7f4] px-4 py-1.5 sm:w-auto sm:border-t-0 sm:pl-0">
          <ExamplePicker
            examples={examples}
            onPick={onPickExample}
            groupLabels={exampleGroupLabels}
          />
          <button
            onClick={() => setOptionsOpen((v) => !v)}
            className="rounded-md border border-[#b9d5ee] bg-white px-3 py-1.5 font-mono text-xs text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eaf4ff]"
          >
            Options
          </button>
          <button
            onClick={onReset}
            className="px-3 py-1.5 font-mono text-xs text-slate-500 transition-colors hover:text-[#235a97]"
          >
            Reset
          </button>
          <button
            onClick={onShare}
            className="rounded-md bg-[#3178c6] px-3 py-1.5 font-mono text-xs text-white shadow-[0_6px_16px_rgba(49,120,198,0.22)] transition-colors hover:bg-[#235a97]"
          >
            {shareToast ? "Copied ✓" : "Share"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="flex h-1/2 min-w-0 flex-1 flex-col border-[#c7dff4] md:h-full md:border-r">
          <div className="flex items-center justify-between border-b border-[#c7dff4] bg-[#eef6ff] px-4 py-1.5">
            <span className="font-mono text-[11px] text-slate-500">
              src/playground.ts
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {source.split("\n").length} lines
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <SourceEditor
              value={source}
              onChange={updateSource}
              extraLibs={mergedExtraLibs}
            />
          </div>
        </div>

        <div className="flex h-1/2 min-w-0 flex-1 flex-col border-t border-[#c7dff4] md:h-full md:border-t-0">
          <div className="flex items-center justify-between border-b border-[#c7dff4] bg-[#eef6ff] px-4 py-1.5">
            <span className="font-mono text-[11px] text-slate-500">
              {target === "javascript"
                ? resultCaption(options)
                : "lint diagnostics"}
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              {result?.type === "error" ? "error" : ""}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            {target === "lint" ? (
              <LintPane diagnostics={lintDiagnostics} />
            ) : (
              <ResultViewer
                language={result?.type === "error" ? "json" : "javascript"}
                value={
                  result === null
                    ? ""
                    : result.type === "error"
                      ? (JSON.stringify(result.value, null, 2) ??
                        String(result.value))
                      : result.value
                }
              />
            )}
          </div>
        </div>
      </div>

      {bundleError && (
        <div className="shrink-0 border-t border-red-300 bg-red-50 px-4 py-1.5 font-mono text-[11px] text-red-700">
          Bundle failed — {bundleError}
        </div>
      )}

      {executeBundle && (
        <div className="flex h-48 shrink-0 flex-col border-t border-[#c7dff4] bg-[#f7fbff]">
          <div className="flex items-center justify-between border-b border-[#d8e7f4] px-4 py-1.5">
            <span className="font-mono text-[11px] text-slate-500">
              console output
            </span>
            <div className="flex items-center gap-2">
              {consoleMessages.length > 0 && (
                <button
                  onClick={() => setConsoleMessages([])}
                  className="px-2 py-1 font-mono text-[10px] text-slate-500 transition-colors hover:text-[#235a97]"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onExecute}
                disabled={executing}
                className="rounded-md bg-[#3178c6] px-3 py-1 font-mono text-[11px] text-white transition-colors hover:bg-[#235a97] disabled:opacity-50"
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
      )}

      <DiagnosticsPanel diagnostics={allDiagnostics} />

      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={updateOptions}
          onClose={() => setOptionsOpen(false)}
          toggles={optionToggles}
        />
      )}

      <DependencyProgressModal
        progress={dependencyProgress}
        packages={dependencyPackageNames}
      />
    </div>
  );
}

function defaultResultCaption(_options: ITransformOptions): string {
  return "dist/playground.js";
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dependencyRootDelta(
  current: readonly string[],
  previous: ReadonlySet<string>,
): { added: string[]; changed: boolean; removed: string[] } {
  const next = new Set(current);
  const added = current.filter((name) => !previous.has(name));
  const removed = [...previous].filter((name) => !next.has(name));
  return {
    added,
    changed: added.length !== 0 || removed.length !== 0,
    removed,
  };
}

function createAbortError(reason: string): Error {
  const error = new Error(`Dependency install aborted: ${reason}.`);
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
