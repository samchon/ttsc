"use client";

import {
  createSandboxRequire,
  loadTypiaRuntimePack,
  PlaygroundShell as PackagedPlaygroundShell,
} from "@ttsc/playground";

import { PLAYGROUND_EXAMPLES } from "../../compiler/PlaygroundExamples";
import typiaTypes from "../../compiler/typia-types.json";

const PLAYGROUND_DEFAULT_SCRIPT = PLAYGROUND_EXAMPLES[0]?.source ?? "";

const TYPIA_RUNTIME_PACK_URL = "/compiler/typia-runtime-pack.json";

/**
 * Build the in-page require sandbox by merging the prebuilt typia runtime
 * pack (for typia.is/random/etc that the transformer emits as
 * require("typia/lib/internal/...")) with the runtime files the shell
 * accumulated from every `installPlaygroundDependencies` call (so a
 * user-typed `import { v4 } from "uuid"` actually resolves at Execute time).
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

export default function PlaygroundShell() {
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
      brand={
        <a
          href="/"
          className="font-mono text-sm font-bold text-white hover:text-blue-400 transition-colors"
        >
          ttsc
        </a>
      }
      resultCaption={(options) =>
        options.typia
          ? "dist/playground.js"
          : "dist/playground.js · typia disabled"
      }
    />
  );
}
