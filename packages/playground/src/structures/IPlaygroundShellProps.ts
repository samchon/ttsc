import type { ReactNode } from "react";

import type { IOptionToggle } from "./IOptionToggle";
import type { IPlaygroundExample } from "./IPlaygroundExample";
import type { ITransformOptions } from "./ITransformOptions";

/**
 * Props for the full playground shell.
 *
 * The shell is intentionally configurable rather than configurable-by-context:
 * every changing field is an explicit prop, so wrappers can spread their own
 * defaults without a Provider in between.
 *
 * @evidence contracts/common.md#principled-implementation Site-owned runtime URL, initial content, presentation and execution policy distinguish required inputs from optional UI features.
 * @evidence contracts/common.md#clear-and-simple-design Explicit props keep site policy outside shell lifecycle implementation; option metadata and example records have their own types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Site policy enters through declared props and callbacks rather than consumer-specific branches.
 * @evidence contracts/common.md#meaningful-documentation Member prose explains defaults, runtime-file namespace and cancellation limits, with documentation-skill paragraphs and member spacing.
 */
export interface IPlaygroundShellProps {
  /**
   * URL of the bundled worker script (rspack output of the site's worker
   * entry).
   */
  workerUrl: string;

  /** Source code shown on first mount (and on Reset). */
  defaultScript: string;

  /** Examples available in the dropdown. Empty array hides the dropdown. */
  examples?: readonly IPlaygroundExample[];

  /** Display labels for example groups. */
  exampleGroupLabels?: Record<string, string>;

  /** Toggles rendered in the Options modal. Defaults to typia + lint. */
  optionToggles?: readonly IOptionToggle[];

  /**
   * Initial values for the transform options. Defaults to `{typia: true, lint:
   * true}`.
   */
  defaultOptions?: ITransformOptions;

  /**
   * Static extra .d.ts entries to mount in Monaco (e.g. a pre-packed typia type
   * pack). Merged with dependencies installed at runtime. Keep the object
   * identity stable across renders: a new object makes the editor dispose and
   * register every declaration again.
   */
  staticEditorLibs?: Record<string, string>;

  /**
   * Packages the site has already pre-mounted into the wasm. These are skipped
   * by the runtime npm dependency installer. Keep the array identity stable
   * across renders: a new array restarts the pending compile debounce.
   */
  preinstalledPackages?: readonly string[];

  /**
   * Optional execute hook. When provided, the shell renders an "Execute"
   * button; on click it calls `service.bundle(...)` to get the JS and passes it
   * here. Calls the hook makes on `sandbox.console` are appended to the Console
   * pane in order; its returned promise carries no messages.
   *
   * `sandbox.runtimeFiles` is the current runtime-file map produced by
   * dependency installation in this session (package-rooted keys like
   * `uuid/dist/index.js`). The site's executeBundle typically merges these on
   * top of its own typia-runtime pack and feeds the union to
   * `createSandboxRequire` — without this channel the in-page Execute sandbox
   * cannot resolve any npm dependency the user installed.
   *
   * `sandbox.signal` aborts when source or compiler options change, a newer
   * Execute starts, the compiler Worker is replaced, or the shell unmounts.
   * Implementations must pass it through to cancellable setup such as
   * runtime-pack fetches. Synchronous evaluated user code cannot be preempted
   * and still requires an isolated executor when untrusted code is accepted.
   *
   * When omitted, the Execute UI is hidden.
   */
  executeBundle?: PlaygroundBundleExecutor;

  /**
   * Brand slot in the toolbar (left side). Renders before the Playground label.
   * Sites typically pass `<a href="/">SiteName</a>`.
   */
  brand?: ReactNode;

  /**
   * Caption shown on the result pane when the active tab is "javascript".
   * Defaults to `"dist/playground.js"`. Receives the current transform options
   * so sites can append `· typia disabled` etc.
   */
  resultCaption?: PlaygroundResultCaption;
}

/**
 * Execute emitted code with session runtime files and attempt-scoped
 * cancellation.
 *
 * The site owns execution isolation. The abort signal can cancel asynchronous
 * setup, but cannot preempt synchronous evaluated code.
 *
 * @evidence contracts/common.md#principled-implementation Emitted code, package-rooted runtime files and cancellation preserve the shell's real execution inputs and isolation boundary.
 * @evidence contracts/common.md#clear-and-simple-design One asynchronous hook keeps site execution policy separate from bundling, console presentation and compiler Worker ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A declared hook permits site-owned isolation without patching foreign runtime behavior.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs describe cancellation limits and ownership before the acknowledgment tags.
 */
export type PlaygroundBundleExecutor = (
  code: string,
  sandbox: {
    /** Console methods supplied by the shell for this execution attempt. */
    console: Record<string, (...args: unknown[]) => void>;

    /** Package-rooted runtime modules in the current dependency graph. */
    runtimeFiles: Record<string, string>;

    /** Cancellation for setup and asynchronous work, not synchronous user code. */
    signal: AbortSignal;
  },
) => Promise<void>;

/**
 * Choose a result-pane caption from current transform options.
 *
 * @evidence contracts/common.md#principled-implementation Current options select presentation text only, without claiming to select emitted filenames.
 * @evidence contracts/common.md#clear-and-simple-design A string-returning presentation callback stays independent of compiler configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A caption is a UI label rather than evidence that a particular output was produced.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies the display purpose and parameter before the separated tags.
 */
export type PlaygroundResultCaption = (options: ITransformOptions) => string;
