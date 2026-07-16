"use client";

import {
  PlaygroundShell as PackagedPlaygroundShell,
  createSandboxRequire,
  loadTypiaRuntimePack,
} from "@ttsc/playground";
import { useEffect } from "react";

import { PLAYGROUND_EXAMPLES } from "../../compiler/PlaygroundExamples";
import typiaTypes from "../../compiler/typia-types.json";

// Nextra's docs Search registers a bubble-phase `window` keydown listener that
// steals `/` (and ⌘/Ctrl-K) to focus the top search box whenever
// `document.activeElement` is not an input/textarea/contentEditable element
// (see nextra `Search`). On the playground that hijacks `/` the moment focus
// sits on the body or the editor chrome instead of Monaco's textarea, so the
// keystroke never reaches the editor and code entry is blocked. This guard runs
// in the capture phase — before Nextra's bubble-phase handler — and cancels
// propagation for exactly the keys Nextra would act on, mirroring its own guard
// so real typing (Monaco's textarea, inputs) is left untouched. It only
// `stopPropagation`s (never `preventDefault`s), so the key still reaches Monaco.
const SEARCH_HOTKEY_TARGETS = new Set([
  "INPUT",
  "SELECT",
  "BUTTON",
  "TEXTAREA",
]);

const useSuppressDocsSearchHotkey = (): void => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const el = document.activeElement;
      // Focus is already inside a text field/editor — Nextra ignores it too, so
      // let the keystroke through untouched.
      if (
        el &&
        (SEARCH_HOTKEY_TARGETS.has(el.tagName) ||
          (el as HTMLElement).isContentEditable)
      )
        return;
      const isSearchHotkey =
        event.key === "/" ||
        (event.key === "k" &&
          !event.shiftKey &&
          (navigator.userAgent.includes("Mac")
            ? event.metaKey
            : event.ctrlKey));
      if (isSearchHotkey) event.stopPropagation();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
};

const PLAYGROUND_DEFAULT_SCRIPT = PLAYGROUND_EXAMPLES[0]?.source ?? "";

const TYPIA_RUNTIME_PACK_URL = "/compiler/typia-runtime-pack.json";

/**
 * Build the in-page require sandbox by merging the prebuilt typia runtime pack
 * (for typia.is/random/etc that the transformer emits as
 * require("typia/lib/internal/...")) with the runtime files the shell
 * accumulated from every `installPlaygroundDependencies` call (so a user-typed
 * `import { v4 } from "uuid"` actually resolves at Execute time).
 */
const executeBundle = async (
  code: string,
  sandbox: {
    console: Record<string, (...args: unknown[]) => void>;
    runtimeFiles: Record<string, string>;
  },
): Promise<void> => {
  const runtimePack = await loadTypiaRuntimePack(TYPIA_RUNTIME_PACK_URL);
  const sandboxRequire = createSandboxRequire(
    { ...runtimePack, ...sandbox.runtimeFiles },
    { console: sandbox.console },
  );
  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  const wrapped = `(function(require, module, exports, console) {\n${code}\n})`;
  const factory = new Function("return " + wrapped)() as (
    req: (s: string) => unknown,
    mod: typeof moduleObj,
    exp: typeof moduleObj.exports,
    c: typeof sandbox.console,
  ) => void;
  factory(sandboxRequire, moduleObj, moduleObj.exports, sandbox.console);
};

export default function TtscWebsitePlaygroundShell() {
  useSuppressDocsSearchHotkey();
  return (
    <PackagedPlaygroundShell
      workerUrl="/compiler/index.js"
      defaultScript={PLAYGROUND_DEFAULT_SCRIPT}
      examples={PLAYGROUND_EXAMPLES}
      exampleGroupLabels={{
        typia: "typia",
        lint: "@ttsc/lint",
        mixed: "mixed",
      }}
      staticEditorLibs={typiaTypes as Record<string, string>}
      executeBundle={executeBundle}
      resultCaption={(options) =>
        options.typia
          ? "dist/playground.js"
          : "dist/playground.js · typia disabled"
      }
    />
  );
}
