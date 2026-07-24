import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies output suppression follows the effective compiler flags rather than
 * a fixed superset of possible JavaScript, declaration, map, and build-info
 * products.
 *
 * 1. Resolve a positional source relative to the launcher's explicit cwd.
 * 2. Let `--emit` override configured declaration-only output.
 * 3. Suppress the default build-info file even under `noEmit`.
 * 4. Honor canonical one-dash, case, and short-alias identities.
 * 5. Separate positional materialization from temporary compiler outputs.
 * 6. Match tsgo's `.js` output for React Native JSX.
 * 7. Include adjacent declarations from external JavaScript inputs.
 */
export const test_watch_topology_models_effective_adjacent_and_incremental_outputs =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-effective-watch-outputs-");
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");

    writeConfig(root, { emitDeclarationOnly: true });
    const adjacentChanges: WatchInputChange[] = [];
    const adjacent = topology(root, adjacentChanges, {
      emit: true,
      files: ["src/main.ts"],
    });
    try {
      adjacent.refresh(false);
      const javascript = path.join(root, "src", "main.js");
      adjacent.setProjectInputs({ root, files: [javascript], globs: [] });
      fs.writeFileSync(javascript, "export const value = 1;\n", "utf8");
      await expectProjectQuiet(adjacentChanges);

      const declaration = path.join(root, "src", "main.d.ts");
      adjacent.setProjectInputs({ root, files: [declaration], globs: [] });
      const previous = projectChangeCount(adjacentChanges);
      fs.writeFileSync(declaration, "export declare const external: 1;\n");
      await waitForProjectChange(adjacentChanges, previous);
    } finally {
      adjacent.close();
    }

    writeConfig(root, { incremental: true, noEmit: true });
    const incrementalChanges: WatchInputChange[] = [];
    const incremental = topology(root, incrementalChanges, {
      emit: false,
      files: [],
    });
    try {
      incremental.refresh(false);
      const buildInfo = path.join(root, "tsconfig.tsbuildinfo");
      incremental.setProjectInputs({ root, files: [buildInfo], globs: [] });
      fs.writeFileSync(buildInfo, "{}\n", "utf8");
      await expectProjectQuiet(incrementalChanges);
    } finally {
      incremental.close();
    }

    writeConfig(root, {});
    const declarationChanges: WatchInputChange[] = [];
    const declaration = topology(root, declarationChanges, {
      emit: true,
      files: [],
      passthrough: ["--DECLARATION", "false", "-D", "-DECLARATIONDIR", "types"],
    });
    try {
      declaration.refresh(false);
      declaration.setProjectInputs({
        root,
        files: [],
        globs: [path.join(root, "types", "**", "*.d.ts")],
      });
      fs.mkdirSync(path.join(root, "types"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "types", "main.d.ts"),
        "export declare const value: 1;\n",
      );
      await expectProjectQuiet(declarationChanges);
    } finally {
      declaration.close();
    }

    const declarationDisabledChanges: WatchInputChange[] = [];
    const declarationDisabled = topology(root, declarationDisabledChanges, {
      emit: true,
      files: [],
      passthrough: [
        "-d",
        "--DECLARATION",
        "false",
        "-declarationDir",
        "types-disabled",
      ],
    });
    try {
      declarationDisabled.refresh(false);
      const disabledDeclaration = path.join(
        root,
        "types-disabled",
        "main.d.ts",
      );
      declarationDisabled.setProjectInputs({
        root,
        files: [disabledDeclaration],
        globs: [],
      });
      fs.mkdirSync(path.dirname(disabledDeclaration), { recursive: true });
      const previous = projectChangeCount(declarationDisabledChanges);
      fs.writeFileSync(
        disabledDeclaration,
        "export declare const external: 1;\n",
      );
      await waitForProjectChange(declarationDisabledChanges, previous);
    } finally {
      declarationDisabled.close();
    }

    const declarationOnlyChanges: WatchInputChange[] = [];
    const declarationOnly = topology(root, declarationOnlyChanges, {
      emit: true,
      files: [],
      passthrough: ["-EMITDECLARATIONONLY"],
    });
    try {
      declarationOnly.refresh(false);
      const declarationOutput = path.join(root, "src", "main.d.ts");
      declarationOnly.setProjectInputs({
        root,
        files: [declarationOutput],
        globs: [],
      });
      fs.writeFileSync(
        declarationOutput,
        "export declare const declarationOnly = 1;\n",
        "utf8",
      );
      await expectProjectQuiet(declarationOnlyChanges);

      const javascriptOutput = path.join(root, "src", "main.js");
      declarationOnly.setProjectInputs({
        root,
        files: [javascriptOutput],
        globs: [],
      });
      const previous = projectChangeCount(declarationOnlyChanges);
      fs.writeFileSync(
        javascriptOutput,
        "export const declarationOnly = 1;\n",
        "utf8",
      );
      await waitForProjectChange(declarationOnlyChanges, previous);
    } finally {
      declarationOnly.close();
    }

    const outDirChanges: WatchInputChange[] = [];
    const outDir = topology(root, outDirChanges, {
      emit: true,
      files: ["src/main.ts"],
      outDir: "launcher-output",
      passthrough: ["-OUTDIR", "passthrough-output"],
    });
    try {
      outDir.refresh(false);
      const passthroughOutput = path.join(
        root,
        "passthrough-output",
        "main.js",
      );
      outDir.setProjectInputs({
        root,
        files: [passthroughOutput],
        globs: [],
      });
      fs.mkdirSync(path.dirname(passthroughOutput), { recursive: true });
      fs.writeFileSync(passthroughOutput, "export const value = 1;\n", "utf8");
      await waitForProjectChange(outDirChanges, 0);

      const launcherOutput = path.join(root, "launcher-output", "main.js");
      outDir.setProjectInputs({
        root,
        files: [launcherOutput],
        globs: [],
      });
      fs.mkdirSync(path.dirname(launcherOutput), { recursive: true });
      fs.writeFileSync(launcherOutput, "export const value = 1;\n", "utf8");
      await expectProjectQuiet(outDirChanges);
    } finally {
      outDir.close();
    }

    const tsxSource = path.join(root, "src", "view.tsx");
    fs.writeFileSync(tsxSource, "export const view = <div />;\n", "utf8");
    const jsxChanges: WatchInputChange[] = [];
    const jsx = topology(root, jsxChanges, {
      emit: true,
      files: ["src/view.tsx"],
      passthrough: ["-JSX", "react-native"],
    });
    try {
      jsx.refresh(false);
      const javascriptOutput = path.join(root, "src", "view.js");
      jsx.setProjectInputs({ root, files: [javascriptOutput], globs: [] });
      fs.writeFileSync(
        javascriptOutput,
        "export const view = <div />;\n",
        "utf8",
      );
      await expectProjectQuiet(jsxChanges);

      const jsxOutput = path.join(root, "src", "view.jsx");
      jsx.setProjectInputs({ root, files: [jsxOutput], globs: [] });
      const previous = projectChangeCount(jsxChanges);
      fs.writeFileSync(jsxOutput, "export const external = <div />;\n", "utf8");
      await waitForProjectChange(jsxChanges, previous);
    } finally {
      jsx.close();
    }

    const externalRoot = TestProject.tmpdir("ttsc-external-javascript-output-");
    const externalJavaScript = path.join(externalRoot, "input.js");
    fs.writeFileSync(externalJavaScript, "export const external = 1;\n");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          declaration: true,
          emitDeclarationOnly: true,
        },
        files: [externalJavaScript],
      }),
      "utf8",
    );
    const externalDeclarationChanges: WatchInputChange[] = [];
    const externalDeclaration = topology(root, externalDeclarationChanges, {
      emit: true,
      files: [],
    });
    try {
      externalDeclaration.refresh(false);
      const declarationOutput = path.join(externalRoot, "input.d.ts");
      externalDeclaration.setProjectInputs({
        root,
        files: [declarationOutput],
        globs: [],
      });
      fs.writeFileSync(
        declarationOutput,
        "export declare const external: 1;\n",
      );
      await expectProjectQuiet(externalDeclarationChanges);
    } finally {
      externalDeclaration.close();
    }
  };

function topology(
  root: string,
  changes: WatchInputChange[],
  options: {
    emit: boolean;
    files: string[];
    outDir?: string;
    passthrough?: string[];
  },
): WatchTopology {
  return new WatchTopology(
    {
      cwd: root,
      emit: options.emit,
      files: options.files,
      outDir: options.outDir,
      passthrough: options.passthrough,
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
  return changeKindCount(changes, "project");
}

function changeKindCount(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
): number {
  return changes.filter((change) => change.kind === kind).length;
}

function delay(milliseconds = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
