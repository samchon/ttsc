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
 */
export interface IPlaygroundShellProps {
  /** URL of the bundled worker script (rspack output of the site's worker entry). */
  workerUrl: string;

  /** Source code shown on first mount (and on Reset). */
  defaultScript: string;

  /** Examples available in the dropdown. Empty array hides the dropdown. */
  examples?: readonly IPlaygroundExample[];
  /** Display labels for example groups. */
  exampleGroupLabels?: Record<string, string>;

  /** Toggles rendered in the Options modal. Defaults to typia + lint. */
  optionToggles?: readonly IOptionToggle[];
  /** Initial values for the transform options. Defaults to `{typia: true, lint: true}`. */
  defaultOptions?: ITransformOptions;

  /**
   * Static extra .d.ts entries to mount in Monaco (e.g. a pre-packed typia
   * type pack). Merged with dependencies installed at runtime.
   */
  staticEditorLibs?: Record<string, string>;

  /**
   * Packages the site has already pre-mounted into the wasm. These are
   * skipped by the runtime npm dependency installer.
   */
  preinstalledPackages?: readonly string[];

  /**
   * Optional execute hook. When provided, the shell renders an "Execute"
   * button; on click it calls `service.bundle(...)` to get the JS and passes
   * it here. The returned messages are appended to the Console pane.
   *
   * When omitted, the Execute UI is hidden.
   */
  executeBundle?: (
    code: string,
    sandbox: {
      console: Record<string, (...args: unknown[]) => void>;
    },
  ) => Promise<void>;

  /**
   * Brand slot in the toolbar (left side). Renders before the Playground
   * label. Sites typically pass `<a href="/">SiteName</a>`.
   */
  brand?: ReactNode;

  /**
   * Caption shown on the result pane when the active tab is "javascript".
   * Defaults to `"dist/playground.js"`. Receives the current transform
   * options so sites can append `· typia disabled` etc.
   */
  resultCaption?: (options: ITransformOptions) => string;
}
