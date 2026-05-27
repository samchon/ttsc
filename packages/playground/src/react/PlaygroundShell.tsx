"use client";

import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BUILT_IN_PLAYGROUND_PACKAGES } from "../npm/BUILT_IN_PLAYGROUND_PACKAGES";
import { collectExternalPackageNames } from "../npm/collectExternalPackageNames";
import { installPlaygroundDependencies } from "../npm/installPlaygroundDependencies";
import type { ICompilerService } from "../structures/ICompilerService";
import type { IConsoleMessage } from "../structures/IConsoleMessage";
import type { IPlaygroundDependencyProgress } from "../structures/IPlaygroundDependencyProgress";
import type { IPlaygroundShellProps } from "../structures/IPlaygroundShellProps";
import type { ITransformOptions } from "../structures/ITransformOptions";
import { ConsoleViewer } from "./ConsoleViewer";
import { createCompilerClient } from "./createCompilerClient";
import { DEFAULT_OPTION_TOGGLES } from "./DEFAULT_OPTION_TOGGLES";
import { DependencyProgressModal } from "./DependencyProgressModal";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ExamplePicker } from "./ExamplePicker";
import { LintPane } from "./LintPane";
import { OptionsPanel } from "./OptionsPanel";
import { ResultViewer } from "./ResultViewer";
import { SourceEditor } from "./SourceEditor";

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
  const [consoleMessages, setConsoleMessages] = useState<IConsoleMessage[]>(
    [],
  );
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
  const dependencyInstallChain = useRef<Promise<void>>(Promise.resolve());
  const dependencyAbort = useRef<AbortController | null>(null);
  // Mirror `preinstalledPackages` into a ref so the worker-teardown
  // effect can read the current value without taking the prop as a
  // dep — listing the array prop in deps would tear down the worker on
  // every parent re-render that produces a fresh array reference.
  const preinstalledPackagesRef =
    useRef<readonly string[]>(preinstalledPackages);
  // The ref tracks names the wasm MemFS already has — preinstalled at boot
  // (via `preinstalledPackages`) plus everything `installPlaygroundDependencies`
  // has added across the session. A useEffect below merges fresh
  // preinstalledPackages prop values into the ref so a parent that swaps
  // the prop later does not race a now-stale Set.
  const installedDependencyNames = useRef<Set<string>>(
    new Set<string>(preinstalledPackages),
  );
  // Accumulated runtime-file map produced by every successful
  // installPlaygroundDependencies call. Threaded through to executeBundle so
  // the in-page Execute sandbox's require can resolve any npm package the
  // user installed (without it, `import {v4} from "uuid"` compiles fine but
  // Execute throws because the worker mounts uuid into the wasm MemFS only).
  const runtimeDependencyFiles = useRef<Record<string, string>>({});
  const sourceVersion = useRef(0);
  const latestSource = useRef(source);
  // Race guards: each pipeline (compile/run vs Execute) owns its own epoch.
  // Sharing one epoch would make a fresh Execute click invalidate an in-
  // flight compile (and vice versa) and leave the spinner/button flags
  // stuck because the older pipeline's finally would see a stale epoch.
  // `updateSource` bumps the COMPILE epoch only — typing aborts a stale
  // compile but does not interrupt a click-driven Execute.
  const compileEpoch = useRef(0);
  const executeEpoch = useRef(0);
  // Retry epoch: each Retry click bumps it; only the latest retry's
  // async block is allowed to write boot state. Prior retries' bodies
  // bail on epoch mismatch so a fast double-Retry can't leave a stale
  // `setBootPhase("ready")` chasing a torn-down connection.
  const retryEpoch = useRef(0);

  const mergedExtraLibs = useMemo(
    () => ({ ...staticEditorLibs, ...editorExtraLibs }),
    [staticEditorLibs, editorExtraLibs],
  );

  const updateSource = useCallback((next: string) => {
    sourceVersion.current++;
    latestSource.current = next;
    // Bump BOTH epochs: typing must abort an in-flight compile (the
    // result would be stale) AND an in-flight Execute (the bundled code
    // would not match what's on screen). Without bumping executeEpoch,
    // an Execute whose dependency install was aborted by this typing
    // would silently treat the abort as success and bundle against an
    // incomplete MemFS — emitting JS for packages the user just edited
    // away from, or failing in confusing ways.
    compileEpoch.current++;
    executeEpoch.current++;
    dependencyAbort.current?.abort(createAbortError("source changed"));
    setDependencyProgress(null);
    setDependencyPackageNames([]);
    setSource(next);
  }, []);

  // ── Sync installedDependencyNames + preinstalledPackagesRef on prop change ──
  // The refs capture the initial value on mount; without this effect a
  // parent that swaps `preinstalledPackages` later would race a stale
  // Set against the fresh prop used in `ignoredPackages` below.
  useEffect(() => {
    preinstalledPackagesRef.current = preinstalledPackages;
    for (const name of preinstalledPackages) {
      installedDependencyNames.current.add(name);
    }
  }, [preinstalledPackages]);

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
  }, [createCompilerService]);

  const installDependenciesForSource = useCallback(
    async (
      input: string,
      version: number = sourceVersion.current,
    ): Promise<unknown | null> => {
      const task = dependencyInstallChain.current.then(async () => {
        const firstPassPackageNames = collectExternalPackageNames(
          input,
          preinstalledPackages,
        );
        const firstPassMissing = firstPassPackageNames.filter(
          (name) => !installedDependencyNames.current.has(name),
        );
        if (firstPassMissing.length === 0) return null;

        await wait(DEPENDENCY_INSTALL_QUIET_MS);
        if (sourceVersion.current !== version) return null;

        const packageNames = collectExternalPackageNames(
          latestSource.current,
          preinstalledPackages,
        );
        const missing = packageNames.filter(
          (name) => !installedDependencyNames.current.has(name),
        );
        if (missing.length === 0) return null;

        if (dependencyProgressTimer.current !== null) {
          window.clearTimeout(dependencyProgressTimer.current);
          dependencyProgressTimer.current = null;
        }
        setDependencyPackageNames(missing);
        const abort = new AbortController();
        dependencyAbort.current = abort;
        try {
          const installed = await installPlaygroundDependencies(missing, {
            installedPackages: installedDependencyNames.current,
            ignoredPackages: preinstalledPackages,
            signal: abort.signal,
            onProgress: setDependencyProgress,
          });
          if (sourceVersion.current !== version) return null;
          if (Object.keys(installed.compilerFiles).length > 0) {
            const service = await createCompilerService();
            await service.installDependencies({
              files: installed.compilerFiles,
              packages: installed.packages.map(({ name, version }) => ({
                name,
                version,
              })),
            });
          }
          for (const pkg of installed.packages) {
            installedDependencyNames.current.add(pkg.name);
          }
          if (Object.keys(installed.editorLibs).length > 0) {
            setEditorExtraLibs((prev) => ({
              ...prev,
              ...installed.editorLibs,
            }));
          }
          // Accumulate runtime files so the in-page Execute sandbox can
          // resolve every package the user installed across this session.
          runtimeDependencyFiles.current = {
            ...runtimeDependencyFiles.current,
            ...installed.runtimeFiles,
          };
          dependencyProgressTimer.current = window.setTimeout(() => {
            setDependencyProgress(null);
            setDependencyPackageNames([]);
            dependencyProgressTimer.current = null;
          }, 350);
          return null;
        } catch (error) {
          if (isAbortError(error)) {
            setDependencyProgress(null);
            setDependencyPackageNames([]);
            return null;
          }
          setDependencyProgress({
            phase: "error",
            packageName: missing[0],
            completed: 0,
            total: missing.length,
            message: describeUnknownError(error),
          });
          dependencyProgressTimer.current = window.setTimeout(() => {
            setDependencyProgress(null);
            setDependencyPackageNames([]);
            dependencyProgressTimer.current = null;
          }, 2400);
          return error;
        } finally {
          if (dependencyAbort.current === abort)
            dependencyAbort.current = null;
        }
      });
      dependencyInstallChain.current = task.then(() => {});
      return task;
    },
    [createCompilerService, preinstalledPackages],
  );

  // ── Run compile when source / options change ──
  //
  // `target` (the active tab) is intentionally NOT a trigger here: the
  // compile produces the same result + lintDiagnostics regardless of
  // which tab the user is looking at; the tab choice only swaps which
  // pane is rendered. Re-running the wasm-heavy pipeline on every tab
  // click would burn multiple seconds of work per click.
  const run = useCallback(
    async (
      input: string,
      opts: ITransformOptions,
      version: number,
    ) => {
      const epoch = ++compileEpoch.current;
      setRunning(true);
      try {
        const dependencyError = await installDependenciesForSource(
          input,
          version,
        );
        if (compileEpoch.current !== epoch) return;
        if (dependencyError) {
          setResult({
            type: "error",
            target: "javascript",
            value: normalizeClientError(dependencyError),
          });
          // Keep prior lintDiagnostics intact — a dependency-install blip
          // shouldn't wipe the user's most recent successful lint output.
          return;
        }
        const service = await createCompilerService();
        const next = await service.compile({
          source: input,
          options: opts,
        });
        if (compileEpoch.current !== epoch) return;
        setResult(next);
        if (opts.lint !== false) {
          const lint = await service.lint({ source: input, options: opts });
          if (compileEpoch.current !== epoch) return;
          setLintDiagnostics(lint.diagnostics);
        } else {
          setLintDiagnostics([]);
        }
      } catch (err) {
        if (compileEpoch.current !== epoch) return;
        // Surface the error in the diagnostics pane via an error result —
        // a transient compile/lint/install rejection (tgrid timeout,
        // message-channel disconnect) must NOT tear the playground into
        // the fatal boot-error screen and force a worker rebuild. Only
        // the eager boot useEffect may flip bootPhase to "failed".
        setResult({
          type: "error",
          target: "javascript",
          value: normalizeClientError(err),
        });
        // Leave lintDiagnostics alone — clearing them on a transient
        // compile blip would wipe the user's last good lint output.
      } finally {
        // Only the winning epoch clears the flag. Older pipelines that
        // returned early on an epoch mismatch must NOT clear running, or
        // a fresh in-flight compile would show "ready" while it's still
        // working. compileEpoch is bumped only by updateSource and by the
        // next run() — Execute uses its own executeEpoch — so this guard
        // does not stick the spinner across pipeline boundaries.
        if (compileEpoch.current === epoch) setRunning(false);
      }
    },
    [createCompilerService, installDependenciesForSource],
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
    },
    [],
  );

  // Tear down the Worker (+ its wasm instance) when the component
  // unmounts or workerUrl changes. Without this an SPA navigation away
  // from the playground leaks one Worker per mount; a workerUrl swap
  // leaks the previous Worker forever.
  //
  // Reset the dependency-tracking refs too. They named packages that
  // existed in the previous worker's MemFS; the fresh worker boots with
  // only `preinstalledPackages` mounted, so carrying the old names
  // would make installDependenciesForSource skip the install (because
  // `installedDependencyNames.current.has(name)` is still true) and
  // the next compile would fail with `Cannot find module`.
  //
  // The effect depends on `[client]` ONLY — listing the array prop
  // `preinstalledPackages` in deps would tear down the worker on every
  // parent re-render that produces a fresh array reference. We read the
  // current value through `preinstalledPackagesRef`, which the sync
  // effect above keeps up to date.
  useEffect(
    () => () => {
      void client.reset();
      installedDependencyNames.current = new Set<string>(
        preinstalledPackagesRef.current,
      );
      runtimeDependencyFiles.current = {};
    },
    [client],
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
    // Bump the executeEpoch so a second Execute click invalidates the
    // in-flight Execute. compileEpoch is unaffected — the user can edit
    // the source mid-Execute without the running compile being torn down.
    const epoch = ++executeEpoch.current;
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
      if (executeEpoch.current !== epoch) return;
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
      if (executeEpoch.current !== epoch) return;
      if (dependencyError) {
        push("error", [dependencyError]);
        return;
      }
      const service = await createCompilerService();
      const compiled = await service.bundle({
        source: currentSource,
        options,
      });
      if (executeEpoch.current !== epoch) return;
      if (compiled.type === "error") {
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
        });
      } catch (error) {
        push("error", [error]);
      }
    } catch (error) {
      if (executeEpoch.current !== epoch) return;
      push("error", [error]);
    } finally {
      // Only the winning epoch clears the flag — same rationale as
      // compileEpoch above. With a separate executeEpoch this is robust
      // against concurrent click + edit interleavings.
      if (executeEpoch.current === epoch) setExecuting(false);
    }
    // `source` is intentionally NOT a dep: the body snapshots
    // `latestSource.current` (always fresh ref) rather than reading the
    // React state, so including `source` here would re-create the
    // callback per keystroke and propagate into the global keydown
    // useEffect, churning event-listener add/remove every character.
  }, [createCompilerService, executeBundle, installDependenciesForSource, options]);

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
      <div className="flex flex-col h-screen w-full items-center justify-center bg-neutral-950 text-neutral-200 gap-5 px-6 text-center">
        <span className="text-red-400 text-3xl">⚠</span>
        <h1 className="text-lg font-mono">Playground failed to boot.</h1>
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
            // Each click bumps retryEpoch; only the latest retry's body
            // writes boot state. A double-click cancels the prior retry's
            // pending writes so it can't flip bootPhase to "ready"
            // against a connection the new retry has already torn down.
            const epoch = ++retryEpoch.current;
            void (async () => {
              await client.reset();
              if (retryEpoch.current !== epoch) return;
              setBootError(null);
              setBootPhase("booting");
              try {
                await createCompilerService();
                if (retryEpoch.current !== epoch) return;
                setBootPhase("ready");
              } catch (err) {
                if (retryEpoch.current !== epoch) return;
                setBootError(err);
                setBootPhase("failed");
              }
            })();
          }}
          className="px-5 py-2 text-xs font-mono text-neutral-900 bg-white rounded-md hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-shadow"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-950 text-neutral-200 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800/70 bg-neutral-950 shrink-0">
        {brand}
        <span className="text-neutral-700">/</span>
        <span className="text-sm text-neutral-400">Playground</span>

        <div className="ml-auto flex items-center gap-2">
          <ExamplePicker
            examples={examples}
            onPick={onPickExample}
            groupLabels={exampleGroupLabels}
          />
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

      {sourceFromURL && (
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-amber-200 bg-amber-500/10 border-b border-amber-700/40">
          Source loaded from share URL. Hit Reset to return to the default
          example.
        </div>
      )}

      {shareWarn && (
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-amber-200 bg-amber-500/10 border-b border-amber-700/40">
          {shareWarn}
        </div>
      )}

      <div className="flex items-center gap-0 border-b border-neutral-800/70 bg-neutral-950 shrink-0">
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
            <SourceEditor
              value={source}
              onChange={updateSource}
              extraLibs={mergedExtraLibs}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col h-1/2 md:h-full border-t md:border-t-0 border-neutral-800/70">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-800/70 bg-neutral-950">
            <span className="text-[11px] font-mono text-neutral-500">
              {target === "javascript"
                ? resultCaption(options)
                : "lint diagnostics"}
            </span>
            <span className="text-[10px] font-mono text-neutral-700">
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
        <div className="shrink-0 px-4 py-1.5 text-[11px] font-mono text-red-300 bg-red-500/10 border-t border-red-700/40">
          Bundle failed — {bundleError}
        </div>
      )}

      {executeBundle && (
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
      )}

      <DiagnosticsPanel diagnostics={allDiagnostics} />

      {optionsOpen && (
        <OptionsPanel
          options={options}
          onChange={setOptions}
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

function normalizeClientError(error: unknown): unknown {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "Error", message: describeUnknownError(error) };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createAbortError(reason: string): Error {
  const error = new Error(`Dependency install aborted: ${reason}.`);
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
