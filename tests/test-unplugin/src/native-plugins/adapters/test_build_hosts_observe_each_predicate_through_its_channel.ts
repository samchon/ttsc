import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pathIsWithin } from "../../../../../packages/unplugin/lib/core/transform/filesystem/pathIsWithin.mjs";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";
import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * Verifies each build host receives every compiler input through the channel
 * that observes its predicate, and that a watching session's bridge signals a
 * change the host's own channel would miss (samchon/ttsc#1388).
 *
 * Every adapter used to register all inputs as plain file dependencies. A
 * created declaration or a new `@types` package never rebuilt Rolldown, Farm,
 * webpack, or Rspack watch sessions. Rollup watched `node_modules` recursively,
 * one chokidar instance per input. The mapping follows each host's measured
 * channels, and a watching session sends what its channels cannot observe
 * precisely through a bounded bridge that rewrites one sentinel per importer.
 *
 * 1. Compile a real native envelope through a one-shot webpack context, and
 *    through watching webpack and Rolldown contexts, and assert each input kind
 *    reaches its channel, with no presence-only directory registered.
 * 2. Deliver the same module through a watching Rolldown context, and assert only
 *    its sentinel is registered and that its signal repeats until the module
 *    runs again; then through a watching Rollup context, and assert only its
 *    sentinel is registered.
 * 3. Write below a package directory and assert the sentinel is untouched. Then
 *    create the missing resolution candidate, and a declaration the tsconfig's
 *    `include` admits, a new root file (samchon/ttsc#1419), and assert each
 *    rewrites it.
 * 4. Close the watcher and assert the sentinel stays: a host's persistent cache
 *    records it, and the next session reuses it (samchon/ttsc#1468).
 */
export async function test_build_hosts_observe_each_predicate_through_its_channel(): Promise<void> {
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
  const isSentinel = (file: string) =>
    file.endsWith(".signal") && !pathIsWithin(file, root);

  const webpack = async (watchMode: boolean) => {
    const channels = {
      context: [] as string[],
      file: [] as string[],
      missing: [] as string[],
    };
    const plugin = await deliver({
      addWatchFile: () => assert.fail("webpack uses its loader channels"),
      getNativeBuildContext: () => ({
        compiler: { watchMode },
        framework: "webpack",
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
  const oneShot = await webpack(false);
  assert.ok(oneShot.file.includes(declaration), "a read declaration is a file");
  assert.ok(
    oneShot.missing.includes(candidate),
    "an absent candidate is missing",
  );
  assert.ok(
    oneShot.context.includes(typeRoot),
    "a listed type root is a context",
  );
  for (const channel of Object.values(oneShot)) {
    assert.ok(
      !channel.includes(packageDirectory),
      "a directory only checked to exist is never registered",
    );
  }
  const watching = await webpack(true);
  assert.deepEqual(
    watching.context,
    [],
    "a watching webpack session bridges listings off its recursive channel",
  );
  assert.ok(watching.file.includes(declaration));
  assert.ok(watching.missing.includes(candidate));
  assert.ok(watching.file.some(isSentinel), "the bridge adds its sentinel");

  // Rolldown drops a change that lands while it is building, so it is handed
  // one sentinel per module, and the bridge repeats a signal until the module
  // registers again (samchon/ttsc#1465).
  const rolldown: string[] = [];
  const rolldownPlugin = await deliver({
    addWatchFile: (file: string) => rolldown.push(file),
    meta: { rolldownVersion: "1", watchMode: true },
  });
  try {
    assert.equal(
      rolldown.length,
      1,
      "Rolldown watches one sentinel per module",
    );
    assert.ok(isSentinel(rolldown[0]!));
    const signal = () => fs.readFileSync(rolldown[0]!, "utf8");
    const initial = signal();
    fs.appendFileSync(declaration, "// edited\n");
    await waitFor(
      () => signal() !== initial,
      "the sentinel to be rewritten for the edited declaration",
    );
    const first = signal();
    await waitFor(
      () => signal() !== first,
      "the signal to repeat while the module has not run again",
    );
  } finally {
    await invoke(rolldownPlugin.closeWatcher, {});
  }

  const rollup: string[] = [];
  const rollupPlugin = await deliver({
    addWatchFile: (file: string) => rollup.push(file),
    meta: { watchMode: true },
  });
  try {
    assert.equal(rollup.length, 1, "Rollup watches one sentinel per module");
    const sentinel = rollup[0]!;
    assert.ok(isSentinel(sentinel));
    const signal = () => fs.readFileSync(sentinel, "utf8");
    const initial = signal();

    fs.writeFileSync(path.join(packageDirectory, "unrelated.txt"), "x");
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(signal(), initial, "a write inside a package signals nothing");

    fs.writeFileSync(candidate, "export declare const native: 1;\n");
    await waitFor(
      () => signal() !== initial,
      "the sentinel to be rewritten when the missing candidate appears",
    );

    const created = signal();
    fs.writeFileSync(
      path.join(root, "src", "membership.d.ts"),
      "declare const membership: 1;\n",
    );
    await waitFor(
      () => signal() !== created,
      "the sentinel to be rewritten when a new root file appears",
    );
  } finally {
    await invoke(rollupPlugin.closeWatcher, {});
  }
  assert.ok(
    fs.existsSync(rollup[0]!),
    "closing the watcher leaves the sentinel for the next session",
  );
}
