import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
  settleWatchEvents,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies response-selected output suppression through actual watch callbacks.
 * Authored product/data twins provide independent expectations. Transport is
 * recorded and compiler membership supplied; no compiler or OS watcher runs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source WatchTopology reads real configs and response files, then admits data callbacks and suppresses independently named products through its public project-input boundary. Edits, deletion and repair exercise response reload ownership.
 * @evidence contracts/testing.md#independent-expectations Literal path/report pairs follow final ordered compiler assignments and the configured controls; neither topology output inference nor private state generates an expected result.
 * @evidence contracts/testing.md#distinguishing-cases Moving outDir, noEmit true/false/null, declarations/maps, incremental/build-info paths, JSX defaults and resets, inline-map suppression, literal @ scalar operands, nested/repeated frames, UTF encodings and final direct overrides distinguish expanded options from top-level token projection. A compiler-source overlap remains a genuine input. Response-selected project and reference configs keep their own products, then a same-session selector edit admits the former product as data. Positional launchers retain their own one-file copy destination and emit authority rather than treating private native products as project-mode outputs.
 * @evidence contracts/testing.md#execution-ownership One tracked temporary project owns real bytes and recorded source-adapter subscriptions. The explicit membership callback asserts the original unexpanded request. finally closes every supplied handle; TestProject removes the allocation at process exit. Actual native emit, watcher transport and compiler processes remain E2E responsibilities.
 */
export async function test_watch_topology_preserves_response_file_output_options(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-watch-response-options-"),
  );
  const source = path.join(root, "view.tsx");
  const response = path.join(root, "flags.rsp");
  const nested = path.join(root, "nested", "inner.rsp");
  const failures: Error[] = [];
  const directories = [
    "configured",
    "selected",
    "final",
    "types",
    "nested",
    "@literal",
  ];
  for (const directory of directories) {
    const location = path.join(root, directory);
    fs.mkdirSync(location);
    fs.writeFileSync(path.join(location, "CaseProof.txt"), "case evidence");
  }
  fs.writeFileSync(source, "export const view = 1;\n");
  // Keep each fixture directory nonempty. On Windows the identity resolver can
  // then observe alternate-name case behavior without launching fsutil. Check
  // the real ancestor chain as well before any topology transaction starts.
  if (process.platform === "win32") {
    const proofDirectories = new Set(
      directories.map((name) => path.join(root, name)),
    );
    let ancestor = root;
    while (true) {
      proofDirectories.add(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor) break;
      ancestor = parent;
    }
    for (const directory of proofDirectories) {
      assert.ok(
        fs.readdirSync(directory).some((name) => {
          const alternate = name.replace(/[a-zA-Z]/, (letter) =>
            letter === letter.toLowerCase()
              ? letter.toUpperCase()
              : letter.toLowerCase(),
          );
          if (alternate === name) return false;
          try {
            fs.realpathSync.native(path.join(directory, name));
            fs.realpathSync.native(path.join(directory, alternate));
            return true;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") return false;
            return fs.existsSync(path.join(directory, name));
          }
        }),
        `fixture has no read-only case witness: ${directory}`,
      );
    }
  }
  const profiles: {
    name: string;
    text: string;
    after?: string[];
    config?: Record<string, unknown>;
    emit?: boolean;
    positional?: boolean;
    encoding?: "utf8-bom" | "utf16le" | "utf16be";
    expected: readonly (readonly [string, boolean])[];
  }[] = [
    {
      name: "moved outDir",
      text: "--outDir selected",
      expected: [["configured/data.md", true], ["selected/data.md", false]],
    },
    {
      name: "later direct assignment",
      text: "--outDir selected",
      after: ["--outDir", "final"],
      expected: [["selected/data.md", true], ["final/data.md", false]],
    },
    {
      name: "noEmit overrides wrapper emit",
      text: "--noEmit",
      emit: true,
      expected: [["configured/view.js", true], ["configured/view.d.ts", true]],
    },
    {
      name: "false overrides wrapper noEmit",
      text: "--noEmit false",
      config: { outDir: null },
      emit: false,
      expected: [["view.jsx", false], ["view.js", true]],
    },
    {
      name: "null clears configured noEmit",
      text: "--noEmit null",
      config: { noEmit: true, outDir: null },
      expected: [["view.jsx", false], ["view.js", true]],
    },
    {
      name: "declaration-only and maps",
      text: "--declaration --emitDeclarationOnly --declarationDir types --declarationMap",
      expected: [
        ["types/view.d.ts", false],
        ["types/view.d.ts.map", false],
        ["configured/view.js", true],
      ],
    },
    {
      name: "incremental build-info",
      text: "--incremental --tsBuildInfoFile selected/state.tsbuildinfo --noEmit",
      expected: [
        ["selected/state.tsbuildinfo", false],
        ["selected/other.tsbuildinfo", true],
      ],
    },
    {
      name: "JSX and source map",
      text: "--jsx react --sourceMap",
      config: { outDir: null },
      expected: [
        ["view.js", false],
        ["view.js.map", false],
        ["view.jsx", true],
      ],
    },
    {
      name: "inline map removes separate product",
      text: "--jsx react --sourceMap --inlineSourceMap",
      config: { outDir: null },
      expected: [["view.js", false], ["view.js.map", true]],
    },
    {
      name: "false map reset",
      text: "--jsx react --sourceMap false",
      config: { sourceMap: true, outDir: null },
      expected: [["view.js", false], ["view.js.map", true]],
    },
    ...["null", '""'].map((value) => ({
      name: `JSX reset ${value}`,
      text: `--jsx ${value}`,
      config: { outDir: null },
      expected: [["view.js", false], ["view.jsx", true]] as const,
    })),
    {
      name: "path reset",
      text: "--outDir null --jsx react",
      expected: [["view.js", false], ["configured/view.js", true]],
    },
    {
      name: "literal @ operand",
      text: "--outDir @literal",
      expected: [["@literal/data.md", false], ["configured/data.md", true]],
    },
    {
      name: "output root overlaps real inputs",
      text: "--outDir .",
      expected: [["data.md", true]],
    },
    {
      name: "composite and default build-info",
      text: "--declarationMap",
      config: { composite: true },
      expected: [
        ["input.md", true],
        ["configured/view.d.ts", false],
        ["configured/view.d.ts.map", false],
        ["configured/tsconfig.tsbuildinfo", false],
      ],
    },
    ...(["utf8-bom", "utf16le", "utf16be"] as const).map((encoding) => ({
      name: encoding,
      text: "--outDir selected",
      encoding,
      expected: [["selected/data.md", false], ["configured/data.md", true]] as const,
    })),
    {
      name: "nested frames retain native cwd",
      text: "@nested/inner.rsp @nested/inner.rsp",
      expected: [["selected/data.md", false], ["configured/data.md", true]],
    },
    {
      name: "positional copy retains launcher destination",
      text: "--outDir selected --jsx react --noEmit",
      positional: true,
      expected: [
        ["configured/view.jsx", false],
        ["selected/view.js", true],
        ["configured/data.md", true],
      ],
    },
    {
      name: "positional wrapper noEmit remains copy authority",
      text: "--noEmit false",
      positional: true,
      emit: false,
      expected: [["configured/view.jsx", true]],
    },
  ];
  for (const [index, profile] of profiles.entries()) {
    const fail = (name: string, cause: unknown): void => {
      failures.push(new Error(`${profile.name}: ${name}`, { cause }));
    };
    const changes: WatchInputChange[] = [];
    let changeResponseDuringRead = false;
    const observed = recordWatchers(watchDirectoryThroughFsWatch);
    const passthrough = ["@flags.rsp", ...(profile.after ?? [])];
    const topology = new WatchTopology(
      {
        cwd: root,
        tsconfig: path.join(root, "tsconfig.json"),
        files: profile.positional ? [source] : [],
        emit: profile.emit,
        passthrough,
      },
      {
        onError: (location, error) => fail(location, error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      observed.openDirectoryWatch,
      observed.openFileWatch,
      fs.readdirSync,
      (project, options) => {
        assert.equal(project.root, root);
        assert.deepEqual(options.passthrough, passthrough);
        if (changeResponseDuringRead)
          fs.writeFileSync(response, "--outDir final");
        return [source];
      },
    );
    try {
      fs.writeFileSync(
        path.join(root, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            outDir: "configured",
            jsx: "preserve",
            ...profile.config,
          },
          files: ["view.tsx"],
        }),
      );
      fs.writeFileSync(nested, "--outDir selected");
      const bytes = profile.encoding?.startsWith("utf16")
        ? Buffer.concat([
            Buffer.from([0xff, 0xfe]),
            Buffer.from(profile.text, "utf16le"),
          ])
        : Buffer.from(
            (profile.encoding === "utf8-bom" ? "\ufeff" : "") + profile.text,
          );
      if (profile.encoding === "utf16be") bytes.swap16();
      fs.writeFileSync(response, bytes);
      const targets = profile.expected.map(([name]) => path.join(root, name));
      for (const target of targets) fs.writeFileSync(target, `initial:${index}`);
      topology.refresh(false);
      topology.setProjectInputs({ root, files: targets, globs: [] });
      await settleWatchEvents();
      for (const [targetIndex, target] of targets.entries()) {
        try {
          const previous = changes.length;
          fs.writeFileSync(target, `changed:${index}:${targetIndex}`);
          deliverWatchEvent(observed.watchers, target, "change");
          await settleWatchEvents();
          assert.equal(
            changes.slice(previous).some(
              (change) => change.kind === "project" && change.path === target,
            ),
            profile.expected[targetIndex]![1],
            profile.expected[targetIndex]![0],
          );
        } catch (cause) {
          fail(profile.expected[targetIndex]![0], cause);
        }
      }
      if (index === 0) {
        const previous = changes.length;
        fs.writeFileSync(response, "--outDir final");
        deliverWatchEvent(observed.watchers, response, "change");
        await settleWatchEvents();
        assert.ok(
          changes.slice(previous).some(
            (change) => change.kind === "config" && change.path === response,
          ),
        );
        topology.refresh(false);
        topology.setProjectInputs({ root, files: targets, globs: [] });
        await settleWatchEvents();
        const beforeData = changes.length;
        fs.writeFileSync(targets[1]!, "now ordinary selected data");
        deliverWatchEvent(observed.watchers, targets[1]!, "change");
        await settleWatchEvents();
        assert.ok(
          changes.slice(beforeData).some(
            (change) => change.kind === "project" && change.path === targets[1],
          ),
        );
        fs.unlinkSync(response);
        assert.throws(() => topology.refresh(false), /ENOENT/);
        fs.writeFileSync(response, "--outDir selected");
        topology.refresh(false);
        changeResponseDuringRead = true;
        assert.throws(
          () => topology.refresh(false),
          /changed after project selection/,
        );
        changeResponseDuringRead = false;
        fs.writeFileSync(response, "--outDir selected");
        topology.refresh(false);
      }
      const beforeSource = changes.length;
      fs.writeFileSync(source, `export const view = ${index + 2};\n`);
      deliverWatchEvent(observed.watchers, source, "change");
      await settleWatchEvents();
      assert.ok(
        changes.slice(beforeSource).some(
          (change) => change.kind === "compiler" && change.path === source,
        ),
      );
    } catch (cause) {
      fail("setup or reload", cause);
    } finally {
      topology.close();
      assert.ok(observed.watchers.every((watcher) => watcher.active === false));
    }
  }
  // A response-selected root and each reference retain their own config/output
  // identity while all forwarded relative options retain the original cwd.
  const other = path.join(root, "other");
  const child = path.join(root, "child");
  for (const directory of [other, child]) {
    fs.mkdirSync(directory);
    fs.mkdirSync(path.join(directory, "products"));
    fs.writeFileSync(path.join(directory, "input.ts"), "export const value = 1;\n");
    fs.writeFileSync(path.join(directory, "data.md"), "declared data");
    fs.writeFileSync(path.join(directory, "products", "data.md"), "product data");
    fs.writeFileSync(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { outDir: "products" }, files: ["input.ts"],
        ...(directory === other ? { references: [{ path: "../child" }] } : {}),
      }),
    );
  }
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"outDir":"configured"},"files":["view.tsx"]}',
  );
  fs.writeFileSync(response, "--project other/tsconfig.json");
  const selectedChanges: WatchInputChange[] = [];
  const selectedWatchers = recordWatchers(watchDirectoryThroughFsWatch);
  const selectedTopology = new WatchTopology(
    { cwd: root, files: [], passthrough: ["@flags.rsp"] },
    {
      onError: (location, cause) => failures.push(new Error(location, { cause })),
      onInputChange: (change) => selectedChanges.push(change),
      onTopologyChange: () => undefined,
    },
    selectedWatchers.openDirectoryWatch,
    selectedWatchers.openFileWatch,
    fs.readdirSync,
    (project, options) => {
      assert.ok([root, other, child].includes(project.root));
      assert.equal(options.compilerArgsCwd, root);
      assert.equal(options.pinCompilerProject, true);
      assert.deepEqual(options.passthrough, ["@flags.rsp"]);
      return [project.root === root ? source : path.join(project.root, "input.ts")];
    },
  );
  try {
    selectedTopology.refresh(false);
    const controls = [
      [path.join(root, "configured/data.md"), true],
      [path.join(other, "data.md"), true],
      [path.join(other, "products/data.md"), false],
      [path.join(child, "data.md"), true],
      [path.join(child, "products/data.md"), false],
    ] as const;
    selectedTopology.setProjectInputs({ root, files: controls.map(([file]) => file), globs: [] });
    await settleWatchEvents();
    for (const [file, expected] of controls) {
      try {
        const before = selectedChanges.length;
        fs.appendFileSync(file, "changed");
        deliverWatchEvent(selectedWatchers.watchers, file, "change");
        await settleWatchEvents();
        assert.equal(
          selectedChanges.slice(before).some((change) => change.kind === "project" && change.path === file),
          expected,
          file,
        );
      } catch (cause) {
        failures.push(new Error("response-selected project/ref callback " + file, { cause }));
      }
    }
    const before = selectedChanges.length;
    fs.writeFileSync(response, "--project tsconfig.json");
    deliverWatchEvent(selectedWatchers.watchers, response, "change");
    await settleWatchEvents();
    assert.ok(selectedChanges.slice(before).some((change) => change.kind === "config" && change.path === response));
    selectedTopology.refresh(false);
    selectedTopology.setProjectInputs({ root, files: controls.map(([file]) => file), globs: [] });
    await settleWatchEvents();
    const formerProduct = path.join(other, "products/data.md");
    const prior = selectedChanges.length;
    fs.appendFileSync(formerProduct, "now declared ordinary data");
    deliverWatchEvent(selectedWatchers.watchers, formerProduct, "change");
    await settleWatchEvents();
    // Reload changes several product/data memberships, so the first input
    // event establishes the new baseline with one aggregate invalidation.
    assert.ok(
      selectedChanges.slice(prior).some(
        (change) =>
          change.kind === "project" &&
          change.invalidate === true &&
          change.path === undefined,
      ),
    );
    // Once that baseline is current, former root/reference products are
    // ordinary declared inputs, while the newly selected product stays quiet.
    for (const [file, expected] of [
      [formerProduct, true],
      [path.join(child, "products/data.md"), true],
      [path.join(root, "configured/data.md"), false],
    ] as const) {
      try {
        const beforeInput = selectedChanges.length;
        fs.appendFileSync(file, "independent content change");
        deliverWatchEvent(selectedWatchers.watchers, file, "change");
        await settleWatchEvents();
        assert.equal(
          selectedChanges.slice(beforeInput).some(
            (change) => change.kind === "project" && change.path === file,
          ),
          expected,
          file,
        );
      } catch (cause) {
        failures.push(new Error("response-reloaded input callback " + file, { cause }));
      }
    }
  } catch (cause) {
    failures.push(new Error("response-selected project/reference reload", { cause }));
  } finally {
    selectedTopology.close();
    assert.ok(selectedWatchers.watchers.every((watcher) => !watcher.active));
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "response output callback matrix failed");
}
