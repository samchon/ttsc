import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  type IRecordedWatcher,
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

const WATCH_EVENT_DEADLINE_MS = 30_000;
const subscriptions = new WeakMap<WatchTopology, IRecordedWatcher[]>();
const membership = new Map<string, string[]>();

/**
 * Verifies output inference and notification decisions in the owning source.
 *
 * Actual config parsing and output inference consume authored compiler members
 * and recorded directory registrations. Changed paths are explicit stimuli;
 * output and non-output twins retain their independent literal expectations.
 *
 * 1. Author build-info, declaration-only and JSX compiler membership matrices.
 * 2. Contrast independently named output products with non-output twins.
 * 3. Deliver each physical event and preserve the original report and quiet
 *    assertions.
 *
 * @evidence contracts/testing.md#behavioral-verification Drives the real WatchTopology: with outFile and incremental, the implicit tsbuildinfo beside the config is a quiet product while bundle.tsbuildinfo next to the outFile is a reported project input; declaration output next to the source reports under -EMITDECLARATIONONLY alone but is quiet under -d with -emitDeclarationOnly; a .js beside an allowJs .jsx input is quiet outside preserve mode.
 * @evidence contracts/testing.md#independent-expectations Authored compiler options, passthrough spellings and file names decide which paths are products: the quiet and reported outcomes are literal and follow the pinned tsgo output naming (build info next to the config rather than the outFile, declarations only when declaration is on, jsx mapped to js outside preserve), not values read back from the topology.
 * @evidence contracts/testing.md#distinguishing-cases Each product is paired with a twin that must report: the outFile build-info twin, standalone emitDeclarationOnly versus declaration plus emitDeclarationOnly, and the jsx-to-js mapping. The twins differ by one option or file name, so an inference that ignored that property would flip an outcome.
 * @evidence contracts/testing.md#execution-ownership Actual source WatchTopology runs config/argument/output decisions with supplied absolute compiler membership and recorded source-adapter subscriptions. No compiler child or native observer runs; retained E2E owns native population and delivery. Every original output and quiet-twin assertion is preserved.
 */
export const test_watch_topology_matches_remaining_tsgo_output_semantics =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-tsgo-output-semantics-"),
    );
    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    membership.set(root, [source]);

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
      notify(outFileIncremental, buildInfo);
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
      notify(outFileIncremental, outFileTwin);
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
      notify(declarationOnly, declarationOutput);
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
      notify(explicitDeclarationOnly, declarationOutput);
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
    membership.set(root, [jsxJavaScript]);
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
      notify(jsxJavaScriptTopology, javascriptOutput);
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
  const observed = recordWatchers(watchDirectoryThroughFsWatch);
  const instance = new WatchTopology(
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
    observed.openDirectoryWatch,
    observed.openFileWatch,
    fs.readdirSync,
    () => {
      const inputs = membership.get(root);
      assert.ok(inputs);
      return inputs;
    },
  );
  subscriptions.set(instance, observed.watchers);
  return instance;
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
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
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

/** Deliver the changed entry, or creation of its not-yet-subscribed ancestor. */
function notify(topology: WatchTopology, changed: string): void {
  const watchers = subscriptions.get(topology);
  assert.ok(watchers);
  let entry = TestProject.physicalPath(changed);
  while (
    !watchers.some((watcher) => {
      if (!watcher.active) return false;
      const relative = path.relative(watcher.location, entry);
      return (
        relative === "" ||
        relative === path.basename(entry) ||
        (watcher.recursive &&
          !relative.startsWith("..") &&
          !path.isAbsolute(relative))
      );
    })
  ) {
    const parent = path.dirname(entry);
    assert.notEqual(parent, entry, `no subscription covers ${changed}`);
    entry = parent;
  }
  deliverWatchEvent(watchers, entry, "rename");
}
