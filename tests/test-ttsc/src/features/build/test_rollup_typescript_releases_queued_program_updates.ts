import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Verifies the shared build dependency releases queued compiler updates when
 * its watch program closes, while live watch programs keep emitting changes.
 *
 * TypeScript 6 can leave a 250 ms update queued after close; executing it
 * recreates watchers. The real compiler runs against recorded system watchers
 * and host timers so lifecycle assertions do not depend on filesystem timing.
 *
 * 1. Run both published entries with quiet, queued and timer-free updates.
 * 2. Preserve live watch updates, then close normally and repeatedly.
 * 3. Verify a failing watcher close preserves its error and cancels updates.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the installed shared Rollup TypeScript plugin's lifecycle hooks and actual classic compiler. After closing, draining real compiler callbacks must create no watchers; the live watch case must emit changed values before close.
 * @evidence contracts/testing.md#independent-expectations Closing ends ownership of pending work; literal zero pending timers and watchers distinguish the known reopen defect. Replacing a timer first requires an actual queued initial timer. Literal emitted values 42, 43 and 44 follow the authored source, independently of timer tracking.
 * @evidence contracts/testing.md#distinguishing-cases Covers no event, queued update, replaced timer, already completed update, continuing watch rebuilds, repeated close, absent timer capabilities, original close failure and a fresh subsequent program. Failed native watcher closure remains observable rather than claiming that foreign failure released its handle.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this direct in-process build-dependency unit. A private temporary project and supported compiler System injection exercise actual TypeScript and plugin hooks without installation, native compilation, child process or real filesystem subscription; separate local child experiments verify natural process exit.
 */
export const test_rollup_typescript_releases_queued_program_updates =
  async (): Promise<void> => {
    const requireConfig = createRequire(
      fileURLToPath(
        new URL("../../../../../config/package.json", import.meta.url),
      ),
    );
    const ts: typeof import("ts-legacy") = requireConfig("typescript");
    type Context = {
      meta: { watchMode: boolean };
      warn(): void;
      error(message: unknown): never;
      addWatchFile(): void;
    };
    type Plugin = {
      buildStart(this: Context, options: object): void;
      buildEnd(this: Context): void;
      closeWatcher(this: Context): void;
      load(this: Context, id: string): Promise<{ code: string } | null>;
    };
    const commonjs: (options: object) => Plugin = requireConfig(
      "@rollup/plugin-typescript",
    );
    const moduleEntry = new URL(
      "../es/index.js",
      pathToFileURL(requireConfig.resolve("@rollup/plugin-typescript")),
    );
    const esm: { default: (options: object) => Plugin } = await import(
      moduleEntry.href
    );
    const scenarios = [
      "quiet",
      "queued",
      "rescheduled",
      "completed",
      "watch",
      "repeated-close",
      "no-timers",
      "close-error",
      "subsequent-program",
    ];
    const failures: Error[] = [];
    for (const [format, createPlugin] of [
      ["CommonJS", commonjs],
      ["ESM", esm.default],
    ] as const) {
      for (const scenario of scenarios) {
        const directory = fs.mkdtempSync(
          path.join(os.tmpdir(), "ttsc-build-timers-"),
        );
        try {
          const entry = path.join(directory, "input.ts");
          fs.writeFileSync(entry, "export const answer: number = 42;\n");
          const config = path.join(directory, "tsconfig.json");
          fs.writeFileSync(
            config,
            JSON.stringify({
              files: ["input.ts"],
              compilerOptions: {
                target: "esnext",
                module: "esnext",
                noLib: true,
                types: [],
                outDir: "out",
              },
            }),
          );
          const watches = new Set<{
            file: string;
            callback: (file: string, event: number) => void;
          }>();
          const timers = new Set<{
            callback: (...args: unknown[]) => void;
            args: unknown[];
          }>();
          const closeFailure = new Error("owned watcher close failed");
          const system: typeof ts.sys = {
            ...ts.sys,
            getCurrentDirectory: () => directory,
            watchFile(file, callback) {
              const watch = { file, callback };
              watches.add(watch);
              return {
                close() {
                  if (scenario === "close-error") throw closeFailure;
                  watches.delete(watch);
                },
              };
            },
            watchDirectory(file, callback) {
              const watch = { file, callback };
              watches.add(watch);
              return {
                close: () => {
                  watches.delete(watch);
                },
              };
            },
            setTimeout(callback, _milliseconds, ...args) {
              const timer = { callback, args };
              timers.add(timer);
              return timer;
            },
            clearTimeout(timer) {
              timers.delete(timer);
            },
          };
          if (scenario === "no-timers") {
            delete system.setTimeout;
            delete system.clearTimeout;
          }
          const plugin = createPlugin({
            typescript: { ...ts, sys: system },
            tsconfig: config,
            include: [entry],
            filterRoot: false,
          });
          const context: Context = {
            meta: { watchMode: scenario === "watch" },
            warn() {},
            error(message) {
              throw new Error(String(message));
            },
            addWatchFile() {},
          };
          let value = 42;
          const change = (): void => {
            const watch = [...watches].find(
              (candidate) => path.resolve(candidate.file) === entry,
            );
            assert.ok(
              watch,
              `${scenario}: compiler watches the selected source`,
            );
            fs.writeFileSync(
              entry,
              `export const answer: number = ${++value};\n`,
            );
            watch.callback(entry, ts.FileWatcherEventKind.Changed);
          };
          const drain = (): void => {
            for (const timer of [...timers]) {
              timers.delete(timer);
              timer.callback(...timer.args);
            }
          };
          await plugin.buildStart.call(context, {});
          const initial = await plugin.load.call(context, entry);
          assert.ok(initial);
          assert.match(initial.code, /answer = 42/);
          if (!["quiet", "repeated-close"].includes(scenario)) change();
          if (scenario === "rescheduled") {
            const previous = [...timers][0];
            assert.ok(previous, "rescheduled: first update queued a timer");
            change();
            assert.equal(timers.has(previous), false);
            assert.equal(timers.size, 1);
          }
          if (["completed", "watch", "no-timers"].includes(scenario)) {
            drain();
            const output = await plugin.load.call(context, entry);
            assert.ok(output);
            assert.match(
              output.code,
              scenario === "no-timers" ? /answer = 42/ : /answer = 43/,
            );
          }
          if (scenario === "close-error") {
            assert.throws(
              () => plugin.buildEnd.call(context),
              (error) => error === closeFailure,
            );
            assert.equal(
              timers.size,
              0,
              "failed close still releases pending work",
            );
            assert.ok(
              watches.size > 0,
              "foreign close failure remains observable",
            );
            continue;
          }
          plugin.buildEnd.call(context);
          if (scenario === "watch") {
            assert.ok(
              watches.size > 0,
              "buildEnd preserves a live watch program",
            );
            change();
            drain();
            const output = await plugin.load.call(context, entry);
            assert.ok(output);
            assert.match(output.code, /answer = 44/);
            plugin.closeWatcher.call(context);
          }
          if (scenario === "repeated-close") plugin.closeWatcher.call(context);
          assert.equal(
            timers.size,
            0,
            `${scenario}: close cancels queued timers`,
          );
          drain();
          assert.equal(watches.size, 0, `${scenario}: no post-close watchers`);
          if (scenario === "subsequent-program") {
            await plugin.buildStart.call(context, {});
            assert.ok(watches.size > 0);
            change();
            plugin.buildEnd.call(context);
            assert.equal(timers.size, 0);
            drain();
            assert.equal(watches.size, 0);
          }
        } catch (error) {
          failures.push(
            new Error(`${format}/${scenario}: lifecycle regression`, {
              cause: error,
            }),
          );
        } finally {
          fs.rmSync(directory, { recursive: true, force: true });
        }
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "Rollup compiler lifecycle regressions",
      );
  };
