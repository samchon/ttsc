import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "../../internal/real-native-envelope/createRealNativeEnvelopeFixture";
import { programRuns } from "../../internal/real-native-envelope/programRuns";
import { waitFor } from "../../internal/real-native-envelope/waitFor";

/**
 * Verifies an esbuild context rebuilds for real compiler directory proofs and
 * recovers from failed loads.
 *
 * Esbuild's own `watchFiles` cannot observe directory membership, so a type
 * package appearing or vanishing reaches it only through the project's record,
 * which the adapter's observer moves; a failed load must name the record too,
 * so a repair reaches the same context without manual invalidation.
 *
 * One esbuild build keeps one watch state per path, taken from the last loader
 * result that named it, so a later module's result masks an earlier module's
 * edit, and a file read of an absent path overwrites its directory read. No
 * compiler input therefore reaches esbuild at all: each goes to the bridge, and
 * esbuild watches only the module and the project's record
 * (samchon/ttsc#1463).
 *
 * 1. Add and remove automatic type packages and their parent directory, asserting
 *    every build hands esbuild nothing but each module and the record.
 * 2. Check shared compilation and reuse across an unchanged rebuild.
 * 3. Recover from deleted, initially broken, and initially absent declarations.
 */
export async function test_real_native_envelope_esbuild_observes_directories_and_recovers(): Promise<void> {
  const esbuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("esbuild");
  const adapter = await TestUnpluginRuntime.loadUnpluginAdapter("esbuild");
  const fixture = createRealNativeEnvelopeFixture();
  const root = fs.realpathSync.native(fixture.root);
  const options = { project: path.join(root, "tsconfig.json") };
  const results: Array<{ errors: unknown[] }> = [];
  let starts = 0;
  // Every path the adapter's results handed each channel in the current build.
  const channels = new Map<string, "watchDirs" | "watchFiles">();
  const collisions: string[] = [];
  const traced = (plugin: any) => ({
    ...plugin,
    setup: (build: any) =>
      plugin.setup(
        new Proxy(build, {
          get(target, key) {
            const value = Reflect.get(target, key);
            if (key !== "onLoad")
              return typeof value === "function" ? value.bind(target) : value;
            return (filter: object, load: (args: object) => Promise<any>) =>
              value.call(target, filter, async (args: object) => {
                const result = await load(args);
                for (const channel of ["watchDirs", "watchFiles"] as const)
                  for (const file of result?.[channel] ?? []) {
                    if ((channels.get(file) ?? channel) !== channel)
                      collisions.push(file);
                    channels.set(file, channel);
                  }
                return result;
              });
          },
        }),
      ),
  });
  const start = () =>
    esbuild.context({
      absWorkingDir: root,
      entryPoints: fixture.modules.slice(0, 4),
      outdir: path.join(root, "dist-esbuild"),
      bundle: true,
      write: false,
      logLevel: "silent",
      plugins: [
        traced(adapter(options)),
        {
          name: "observe-native-esbuild",
          setup(build: any) {
            build.onStart(() => {
              starts += 1;
              channels.clear();
            });
            build.onEnd((result: { errors: unknown[] }) => {
              results.push(result);
            });
          },
        },
      ],
    });
  const nextResult = async (count: number, failed = false) => {
    // The first event can build the shared native host on a cold cache. Later
    // events must arrive promptly; no fixed delay is paid on either path.
    // A timeout names which side stalled: a build esbuild never started, one
    // that started and never ended, or a recompile still running.
    await waitFor(
      () => results.length >= count,
      "esbuild watch result",
      count === 1 ? 240_000 : 20_000,
    ).catch((error: Error) => {
      throw new Error(
        `${error.message} ${count}: ${starts} build(s) started, ${results.length} ended, ${programRuns(fixture.runLog)} compile(s)`,
      );
    });
    assert.equal(results[count - 1]!.errors.length !== 0, failed);
    assert.deepEqual(collisions, [], "a path reached both watch channels");
    assert.deepEqual(
      [...channels.keys()].filter(
        (file) =>
          !/[\\/]records[\\/][0-9a-f]{32}\.json$/.test(file) &&
          !(
            /\.[cm]?tsx?$/.test(file) &&
            !file.endsWith(".d.ts") &&
            !file.includes("node_modules")
          ),
      ),
      [],
      "esbuild is handed nothing but each module and the record",
    );
  };
  const observe = async (change: () => void, failed = false) => {
    const count = results.length + 1;
    change();
    await nextResult(count, failed);
  };
  let context = await start();
  try {
    await context.watch();
    await nextResult(1);
    assert.equal(programRuns(fixture.runLog), 1);
    const generated = path.join(fixture.automaticTypesDirectory, "generated");
    fs.mkdirSync(generated);
    fs.writeFileSync(
      path.join(generated, "index.d.ts"),
      "declare const generatedGlobal: string;\n",
    );
    await nextResult(2);
    assert.equal(programRuns(fixture.runLog), 2);
    fs.rmSync(generated, { recursive: true });
    await nextResult(3);
    assert.equal(programRuns(fixture.runLog), 3);
    await context.rebuild();
    assert.equal(programRuns(fixture.runLog), 3);
    await observe(() =>
      fs.rmSync(fixture.automaticTypesDirectory, { recursive: true }),
    );
    assert.equal(programRuns(fixture.runLog), 4);
    await observe(() => {
      fs.mkdirSync(generated, { recursive: true });
      fs.writeFileSync(
        path.join(generated, "index.d.ts"),
        "declare const generatedGlobal: string;\n",
      );
    });
    assert.equal(programRuns(fixture.runLog), 5);

    const declaration = fs.readFileSync(fixture.declaration, "utf8");
    const runtimeFile = path.join(
      path.dirname(fixture.declaration),
      "index.js",
    );
    const runtime = fs.readFileSync(runtimeFile, "utf8");
    // Remove the runtime fallback too: this fixture permits untyped JS, so
    // deleting only the declaration legitimately resolves to index.js.
    await observe(() => {
      fs.unlinkSync(fixture.declaration);
      fs.unlinkSync(runtimeFile);
    }, true);
    await observe(() => {
      fs.writeFileSync(fixture.declaration, declaration);
      fs.writeFileSync(runtimeFile, runtime);
    });
    await context.dispose();

    // An initially failing compilation has no prior successful esbuild watch
    // result to retain. Its error result must carry its own dependencies.
    fs.writeFileSync(fixture.declaration, "export interface Shared {\n");
    results.length = 0;
    context = await start();
    await context.watch();
    await nextResult(1, true);
    fs.writeFileSync(fixture.declaration, declaration);
    await nextResult(2);
    await context.dispose();

    // TS2307 names the consumer, not the missing dependency. Recovery must
    // come from the failed native Program's graph, with no successful history.
    fs.unlinkSync(fixture.declaration);
    fs.unlinkSync(runtimeFile);
    results.length = 0;
    context = await start();
    await context.watch();
    await nextResult(1, true);
    fs.writeFileSync(fixture.declaration, declaration);
    fs.writeFileSync(runtimeFile, runtime);
    await nextResult(2);
  } finally {
    await context.dispose();
  }
}
