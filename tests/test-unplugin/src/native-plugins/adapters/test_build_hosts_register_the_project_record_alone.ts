import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readProjectRecordFile } from "../../../../../packages/unplugin/lib/core/bridge/readProjectRecordFile.js";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies every build host is handed the project's record as a module's one
 * dependency, through the host's own file channel, and that a watching
 * session's bridge moves the record for every change the compiler's inputs can
 * undergo, and for nothing else (samchon/ttsc#1388).
 *
 * A generation compiles the whole project, so a module's output is a function
 * of the project's state and of nothing finer. Every adapter used to hand each
 * host every compiler input through channels the host observes imprecisely, or
 * not at all, and each host differently, and every flaw of a host's channel
 * became the adapter's. The host now watches the record like any file, and the
 * adapter's own observer decides when it moves.
 *
 * 1. Deliver a real native envelope through a one-shot webpack context and a
 *    watching one, and assert the loader context receives the record through
 *    `addDependency` and nothing through the missing or directory channels;
 *    then through a watching Rspack, Rolldown, and Rollup context, and assert
 *    each receives the record alone through `addWatchFile`.
 * 2. Assert the record names the read declaration, the absent resolution
 *    candidate, and the listed type root, with the state the generation
 *    recorded, and carries the walk.
 * 3. On the watching Rollup session, edit the declaration and assert the record
 *    moves and moves again until a delivery in a new pass reads the edit; write
 *    below a package directory and assert it stays; create the missing
 *    candidate, and a declaration the tsconfig's `include` admits
 *    (samchon/ttsc#1419), and assert each moves it.
 * 4. Close the watcher and assert the record stays: a host's persistent cache
 *    holds it, and the next start proves it (samchon/ttsc#1468).
 */
export async function test_build_hosts_register_the_project_record_alone(): Promise<void> {
  const fixture = createRealNativeEnvelopeFixture();
  const root = fs.realpathSync.native(fixture.root);
  const at = (file: string) =>
    path.join(root, path.relative(fixture.root, file));
  const module = at(fixture.modules[0]!);
  const source = fs.readFileSync(module, "utf8");
  const typeRoot = at(fixture.automaticTypesDirectory);
  const declaration = at(fixture.declaration);
  const packageDirectory = path.join(root, "node_modules", "typed-dep");
  // A module-suffix candidate the resolver probed and found absent; creating
  // it changes what the import resolves to.
  const candidate = path.join(packageDirectory, "dist", "index.native.d.ts");
  const options = { project: path.join(root, "tsconfig.json") };
  const factory = await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const openPlugin = (): any =>
    [factory(options)]
      .flat()
      .find((entry: any) => entry?.name === "ttsc-unplugin");
  const invoke = (hook: any, context: object, ...args: unknown[]): unknown =>
    typeof hook === "function"
      ? hook.apply(context, args)
      : hook?.handler?.apply(context, args);
  const deliver = async (context: object) => {
    const plugin = openPlugin();
    await invoke(plugin.buildStart, {});
    assert.ok(await invoke(plugin.transform, context, source, module));
    return plugin;
  };
  const isRecord = (file: string) =>
    file.endsWith(".json") && path.basename(path.dirname(file)) === "records";

  const loaderHost = async (
    framework: "rspack" | "webpack",
    watchMode: boolean,
  ) => {
    const channels = {
      context: [] as string[],
      file: [] as string[],
      missing: [] as string[],
    };
    const plugin = await deliver({
      addWatchFile: () => assert.fail(`${framework} uses its loader channels`),
      getNativeBuildContext: () => ({
        compiler: { watchMode },
        framework,
        loaderContext: {
          addContextDependency: (file: string) => channels.context.push(file),
          addDependency: (file: string) => channels.file.push(file),
          addMissingDependency: (file: string) => channels.missing.push(file),
        },
      }),
    });
    await invoke(plugin.closeWatcher, {});
    return channels;
  };
  for (const [framework, watchMode] of [
    ["webpack", false],
    ["webpack", true],
    ["rspack", true],
  ] as const) {
    const channels = await loaderHost(framework, watchMode);
    assert.equal(channels.file.length, 1, `${framework}: one file dependency`);
    assert.ok(isRecord(channels.file[0]!), `${framework}: the record`);
    assert.deepEqual(channels.missing, [], `${framework}: no missing path`);
    assert.deepEqual(channels.context, [], `${framework}: no directory`);
  }
  const rolldown: string[] = [];
  const rolldownPlugin = await deliver({
    addWatchFile: (file: string) => rolldown.push(file),
    meta: { rolldownVersion: "1", watchMode: true },
  });
  await invoke(rolldownPlugin.closeWatcher, {});
  assert.equal(rolldown.length, 1, "Rolldown watches the record");
  assert.ok(isRecord(rolldown[0]!));

  const rollup: string[] = [];
  const rollupContext = {
    addWatchFile: (file: string) => rollup.push(file),
    meta: { watchMode: true },
  };
  const rollupPlugin = await deliver(rollupContext);
  // A delivery in a new pass, which reads the project again; the pass that
  // served the module before the edit would serve it the same state.
  const redeliver = async () => {
    await invoke(rollupPlugin.buildStart, {});
    assert.ok(
      await invoke(rollupPlugin.transform, rollupContext, source, module),
    );
  };
  try {
    assert.equal(rollup.length, 1, "Rollup watches the record");
    const record = rollup[0]!;
    assert.ok(isRecord(record));
    const written = readProjectRecordFile(record);
    assert.ok(written !== undefined, "the record is written");
    assert.equal(written.tsconfig, options.project);
    for (const input of [declaration, candidate, typeRoot]) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(written.inputs, input),
        `the record names ${path.relative(root, input)}`,
      );
    }
    assert.ok(written.membership !== null, "the record carries the walk");

    const signal = () => fs.readFileSync(record, "utf8");
    const initial = signal();
    fs.appendFileSync(declaration, "// edited\n");
    await waitFor(
      () => signal() !== initial,
      "the record to move for the edited declaration",
    );
    const first = signal();
    await waitFor(
      () => signal() !== first,
      "the move to repeat while the module has not run again",
    );
    await redeliver();
    const delivered = signal();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(signal(), delivered, "a delivery that read the edit ends it");

    fs.writeFileSync(path.join(packageDirectory, "unrelated.txt"), "x");
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(signal(), delivered, "a write inside a package moves nothing");

    // The candidate the resolver prefers once it exists, declaring what the
    // modules import, so the delivery that reads it compiles.
    fs.writeFileSync(
      candidate,
      "export interface Shared { label: string; native?: 1 }\n",
    );
    await waitFor(
      () => signal() !== delivered,
      "the record to move when the missing candidate appears",
    );
    await redeliver();
    const created = signal();
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(signal(), created, "the delivery that read the candidate");
    fs.writeFileSync(
      path.join(root, "src", "membership.d.ts"),
      "declare const membership: 1;\n",
    );
    await waitFor(
      () => signal() !== created,
      "the record to move when a new root file appears",
    );
  } finally {
    await invoke(rollupPlugin.closeWatcher, {});
  }
  assert.ok(
    fs.existsSync(rollup[0]!),
    "closing the watcher leaves the record for the next session",
  );
}
