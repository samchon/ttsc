import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies project-mode output suppression follows the pinned tsgo semantics
 * for outputs whose names are not implied by their nearest input spelling.
 *
 * 1. Derive the implicit build-info file from the config, not `outFile`.
 * 2. Do not infer declarations from standalone `emitDeclarationOnly`.
 * 3. Infer declarations when `declaration` is also enabled.
 * 4. Map an emitted JavaScript `.jsx` input to `.js` outside preserve mode.
 */
export const test_watch_topology_matches_remaining_tsgo_output_semantics =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-tsgo-output-semantics-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");

    writeConfig(root, {
      incremental: true,
      module: "amd",
      outFile: "dist/bundle.js",
    });
    const outFileIncrementalChanges: WatchInputChange[] = [];
    const outFileIncremental = topology(root, outFileIncrementalChanges);
    try {
      outFileIncremental.refresh(false);
      const buildInfo = path.join(root, "tsconfig.tsbuildinfo");
      outFileIncremental.setProjectInputs({
        root,
        files: [buildInfo],
        globs: [],
      });
      fs.writeFileSync(buildInfo, "{}\n", "utf8");
      await expectProjectQuiet(outFileIncrementalChanges);

      const outFileTwin = path.join(root, "dist", "bundle.tsbuildinfo");
      outFileIncremental.setProjectInputs({
        root,
        files: [outFileTwin],
        globs: [],
      });
      fs.mkdirSync(path.dirname(outFileTwin), { recursive: true });
      const previous = projectChangeCount(outFileIncrementalChanges);
      fs.writeFileSync(outFileTwin, "{}\n", "utf8");
      await waitForProjectChange(outFileIncrementalChanges, previous);
    } finally {
      outFileIncremental.close();
    }

    writeConfig(root, {});
    const declarationOnlyChanges: WatchInputChange[] = [];
    const declarationOnly = topology(root, declarationOnlyChanges, [
      "-EMITDECLARATIONONLY",
    ]);
    try {
      declarationOnly.refresh(false);
      const declarationOutput = path.join(root, "src", "main.d.ts");
      declarationOnly.setProjectInputs({
        root,
        files: [declarationOutput],
        globs: [],
      });
      const previous = projectChangeCount(declarationOnlyChanges);
      fs.writeFileSync(
        declarationOutput,
        "export declare const declarationOnly = 1;\n",
        "utf8",
      );
      await waitForProjectChange(declarationOnlyChanges, previous);
    } finally {
      declarationOnly.close();
    }

    const explicitDeclarationOnlyChanges: WatchInputChange[] = [];
    const explicitDeclarationOnly = topology(
      root,
      explicitDeclarationOnlyChanges,
      ["-d", "-emitDeclarationOnly"],
    );
    try {
      explicitDeclarationOnly.refresh(false);
      const declarationOutput = path.join(root, "src", "main.d.ts");
      explicitDeclarationOnly.setProjectInputs({
        root,
        files: [declarationOutput],
        globs: [],
      });
      fs.writeFileSync(
        declarationOutput,
        "export declare const explicitDeclarationOnly = 1;\n",
        "utf8",
      );
      await expectProjectQuiet(explicitDeclarationOnlyChanges);
    } finally {
      explicitDeclarationOnly.close();
    }

    const jsxJavaScript = path.join(root, "src", "input.jsx");
    fs.writeFileSync(jsxJavaScript, "export const input = <div />;\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { allowJs: true, jsx: "react" },
        files: ["src/input.jsx"],
      }),
      "utf8",
    );
    const jsxJavaScriptChanges: WatchInputChange[] = [];
    const jsxJavaScriptTopology = topology(root, jsxJavaScriptChanges);
    try {
      jsxJavaScriptTopology.refresh(false);
      const javascriptOutput = path.join(root, "src", "input.js");
      jsxJavaScriptTopology.setProjectInputs({
        root,
        files: [javascriptOutput],
        globs: [],
      });
      fs.writeFileSync(
        javascriptOutput,
        "export const input = React.createElement('div');\n",
        "utf8",
      );
      await expectProjectQuiet(jsxJavaScriptChanges);
    } finally {
      jsxJavaScriptTopology.close();
    }
  };

function topology(
  root: string,
  changes: WatchInputChange[],
  passthrough?: string[],
): WatchTopology {
  return new WatchTopology(
    {
      cwd: root,
      emit: true,
      files: [],
      passthrough,
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    },
    {
      onError: (location, error) => {
        throw new Error(`watch error on ${location}`, { cause: error });
      },
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
  );
}

function writeConfig(
  root: string,
  compilerOptions: Record<string, unknown>,
): void {
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions,
      files: ["src/main.ts"],
    }),
    "utf8",
  );
}

async function expectProjectQuiet(
  changes: readonly WatchInputChange[],
): Promise<void> {
  const count = projectChangeCount(changes);
  await delay();
  assert.equal(projectChangeCount(changes), count);
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

function delay(milliseconds = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
