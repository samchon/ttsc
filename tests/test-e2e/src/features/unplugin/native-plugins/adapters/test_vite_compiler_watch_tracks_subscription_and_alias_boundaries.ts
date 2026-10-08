import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../../../packages/unplugin/lib/core/transform/watch/captureWatchInputBaseline.js";
import { WATCH_BROKER } from "../../../../../../../packages/unplugin/lib/core/transform/tracker/broker/WATCH_BROKER.js";
import { createViteServeInputWatch } from "../../../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { waitFor } from "../../../../internal/unplugin/internal/adapter-vite-serve/waitFor";

/**
 * Verifies the Vite serve watcher observes subscription races, lexical aliases,
 * and path predicates on the real filesystem.
 *
 * A compiler input can change between the compile that recorded it and the
 * moment the watcher subscribes, and it can be reached through junctions,
 * symlinks and case-folded spellings. Each of those is a way to miss an
 * invalidation or to fire one for an unchanged spelling, so the watcher is
 * driven against real filesystem transitions rather than simulated events.
 *
 * 1. Register inputs that change before subscription, through retargeted links and
 *    renamed ancestors, and under another case spelling.
 * 2. Assert each change invalidates exactly its importers, including file,
 *    directory and membership predicates.
 * 3. Move and recreate the watched project root, recover its compiler-only input,
 *    reattach at the same spelling and verify a fresh native subscription.
 * 4. Dispose the actual watcher after file, directory and membership predicate
 *    transitions. Injected proof races, hardlink polling, identity-policy reset
 *    and importer cleanup execute in the source unit
 *    test_vite_compiler_watch_preserves_race_and_fallback_lifetimes.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual filesystem watcher invalidates changed importers while preserving unchanged aliases and file predicates across deletion before subscription, junction retargeting, ancestor rename, case spelling, external symlink and directory membership transitions. A root replacement uses the actual native backend with an explicitly captured poll: one tick retires old authority, replacement edits are observed conservatively, and same-root attachment plus final dispose/reopen each receive subsequent edits without another fallback tick.
 * @evidence contracts/testing.md#independent-expectations Authored filesystem transitions and literal predicate states define expected invalidation; host hash helper is used for baseline encoding, not expected callback sets.
 * @evidence contracts/testing.md#distinguishing-cases Deletion before subscribe, retargeted junction, ancestor rename, conditional case aliases, external symlink and directory/file/listing predicates. Root replacement retains equal bytes until a later edit, distinguishes the old physical target from the replacement, and preserves overlapping importer ownership on same-root attachment. Original and fresh-reopen positive controls prevent a disabled watcher from passing. Source-unit proof races and resource ownership remain separate.
 * @evidence contracts/testing.md#execution-ownership The selected Vite DAG calls this body with upfront native-vite-watch and disjoint external coordinates. One actual observer owns the existing cases; a child-project observer and its final fresh replacement own root-lifecycle controls through the same real native backend. The root poll scheduler is captured explicitly; no watch or filesystem double, compiler or live Vite server supplies their notifications.
 * @evidence contracts/e2e.md#necessary-boundary Real filesystem watcher events, junction retargeting, ancestor rename and external symlink writes connect native subscriptions to captured Vite invalidation. No native compiler or live Vite server is required for this notification boundary.
 * @evidence contracts/e2e.md#shared-execution One temporary filesystem corpus and one actual watcher serve the existing subscription, lexical-alias and predicate transitions. The same native backend is reused for a project-root lifecycle with a captured poll; a final disposal and reopen is necessary to contrast complete lifecycle recovery with same-root attachment. No compiler, Vite server or native artifact is rebuilt for these notifications.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct importer identities and invalidation sets distinguish transitions. The root lifecycle uses an owned child directory with process cwd outside it; both moved and replacement directories remain under the planned corpus and each observer is released in finally. Broker readiness is awaited before native controls, and their edits receive no fallback tick. Tracked roots end at process exit. Source-unit injected schedulers have their own final-owner close assertions.
 * @evidence contracts/e2e.md#preserved-coverage The actual watcher assertions above remain here. All 22 direct assertions in the five injected race, hardlink-poll, identity-policy and importer-release helpers execute unchanged in test_vite_compiler_watch_preserves_race_and_fallback_lifetimes through authored source APIs; its supported poll collaborators avoid native observers and real interval timers.
 */
export async function test_vite_compiler_watch_tracks_subscription_and_alias_boundaries(prepared?: {
  root: string;
  externalRoot: string;
  retain(reason: string): void;
}): Promise<void> {
  const trace = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
    begin(): string | undefined;
    record(
      event: string,
      invocation: string | undefined,
      fields: Record<string, unknown>,
    ): void;
  };
  const invocation = trace.begin();
  const root = fs.realpathSync.native(
    prepared?.root ?? TestProject.tmpdir("ttsc-vite-watch-boundary-"),
  );
  const invalidated = new Set<string>();
  const watch = createViteServeInputWatch();
  const failures: unknown[] = [];
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) => new Set([{ file }]),
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  const importer = (name: string) =>
    path.join(root, `${name}.ts`).replace(/\\/g, "/");
  const evidence = (file: string) => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    return {
      identity: baseline.identity,
      missing: !baseline.fileExists,
      state: { codec: "host" as const, hash: baseline.hostHash },
    };
  };
  try {
    const file = path.join(root, "input.txt");
    fs.writeFileSync(file, "before");
    const compiled = evidence(file);
    fs.unlinkSync(file);
    watch.replace(importer("race"), [{ file, evidence: compiled }]);
    await waitFor(
      () => invalidated.has(importer("race")),
      "deletion before initial subscription",
    );

    for (const target of ["a", "b"]) {
      fs.mkdirSync(path.join(root, target));
      fs.writeFileSync(path.join(root, target, "value.txt"), target);
    }
    for (const alias of ["alias-a", "alias-b"]) {
      fs.symlinkSync(path.join(root, "a"), path.join(root, alias), "junction");
      const input = path.join(root, alias, "value.txt");
      watch.replace(importer(alias), [
        { file: input, evidence: evidence(input) },
      ]);
    }
    // Let the initial add events establish subscriptions before retargeting.
    // A synchronization input's invalidation proves the real event loop ran.
    fs.writeFileSync(file, "sync");
    watch.replace(importer("sync"), [{ file, evidence: compiled }]);
    await waitFor(
      () => invalidated.has(importer("sync")),
      "initial filesystem observations",
    );
    fs.rmSync(path.join(root, "alias-b"));
    fs.symlinkSync(
      path.join(root, "b"),
      path.join(root, "alias-b"),
      "junction",
    );
    await waitFor(
      () => invalidated.has(importer("alias-b")),
      "existing input through a retargeted junction",
    );
    assert.ok(
      !invalidated.has(importer("alias-a")),
      "one alias must not invalidate an unchanged spelling",
    );

    const nested = path.join(root, "ordinary", "nested", "value.txt");
    fs.mkdirSync(path.dirname(nested), { recursive: true });
    fs.writeFileSync(nested, "nested");
    watch.replace(importer("directory-rename"), [
      { file: nested, evidence: evidence(nested) },
    ]);
    await TestProject.rename(
      path.join(root, "ordinary"),
      path.join(root, "ordinary-moved"),
    );
    await waitFor(
      () => invalidated.has(importer("directory-rename")),
      "an ancestor directory rename",
    );

    const caseProbe = path.join(root, "Case-Watch-Probe.ts");
    const alternateCaseProbe = path.join(root, "case-watch-probe.ts");
    fs.writeFileSync(caseProbe, "probe");
    const caseInsensitive = fs.existsSync(alternateCaseProbe);
    fs.unlinkSync(caseProbe);
    if (caseInsensitive) {
      watch.replace(
        importer("case-insensitive-creation"),
        [{ file: caseProbe, evidence: evidence(caseProbe) }],
        false,
        watch.begin(),
      );
      fs.writeFileSync(alternateCaseProbe, "created");
      await waitFor(
        () => invalidated.has(importer("case-insensitive-creation")),
        "case-insensitive creation under a different spelling",
      );
    }

    if (process.platform !== "win32") {
      const externalRoot =
        prepared?.externalRoot ??
        TestProject.tmpdir("ttsc-vite-watch-external-link-");
      const external = path.join(externalRoot, "value.txt");
      const linked = path.join(root, "external-value.txt");
      fs.writeFileSync(external, "before");
      fs.symlinkSync(external, linked, "file");
      watch.replace(importer("external-file-link"), [
        { file: linked, evidence: evidence(linked) },
      ]);
      fs.writeFileSync(external, "after");
      await waitFor(
        () => invalidated.has(importer("external-file-link")),
        "content behind an external file symlink",
      );
    }

    const candidate = path.join(root, "candidate.ts");
    const identity = evidence(candidate).identity;
    for (const [name, observation] of [
      ["exists", { directoryExists: false, fileExists: false }],
      ["file", { fileExists: false }],
    ] as const) {
      watch.replace(importer(name), [
        {
          file: candidate,
          evidence: {
            identity,
            missing: true,
            state: { codec: "predicates", observation },
          },
        },
      ]);
    }
    fs.mkdirSync(candidate);
    await waitFor(
      () => invalidated.has(importer("exists")),
      "directory availability predicate",
    );
    assert.ok(
      !invalidated.has(importer("file")),
      "a directory does not satisfy a file predicate",
    );
    watch.replace(importer("listing"), [
      {
        file: candidate,
        evidence: {
          identity,
          missing: false,
          state: {
            codec: "predicates",
            observation: {
              directoryExists: true,
              accessibleEntries: { directories: [], files: [] },
            },
          },
        },
      },
    ]);
    fs.writeFileSync(path.join(candidate, "member.txt"), "member");
    await waitFor(
      () => invalidated.has(importer("listing")),
      "exact directory membership predicate",
    );
    fs.rmSync(candidate, { recursive: true });
    fs.writeFileSync(candidate, "file");
    await waitFor(
      () => invalidated.has(importer("file")),
      "file predicate retained after a different predicate changed",
    );
  } catch (error) {
    failures.push(error);
  }
  try {
    // Keep process cwd and the planned corpus root outside the moved project.
    // Windows can move this watched child without moving the process's cwd.
    const project = path.join(root, "root-lifecycle");
    const moved = path.join(root, "root-lifecycle-moved");
    const input = path.join(project, "types.d.ts");
    const stable = path.join(project, "stable.d.ts");
    const owner = path.join(project, "main.ts").replaceAll(path.sep, "/");
    const retained = path.join(project, "other.ts").replaceAll(path.sep, "/");
    const notifications = new Set<string>();
    let tick: (() => void) | undefined;
    let current = createViteServeInputWatch({
      poll(listener) {
        tick = listener;
        return {
          close: () => {
            tick = undefined;
          },
        };
      },
    });
    const server = {
      config: { root: project, server: { watch: { usePolling: false } } },
      moduleGraph: {
        getModulesByFile: (file: string) => new Set([{ file }]),
        invalidateModule: (node: unknown) =>
          notifications.add((node as { file: string }).file),
      },
    };
    const write = (): void => {
      fs.mkdirSync(project);
      TestProject.writeFiles(
        project,
        FixtureFiles.read("unplugin/vite_watch_root_authority/inputs-1"),
      );
    };
    const register = (): void => {
      current.replace(owner, [{ file: input, evidence: evidence(input) }]);
      current.replace(retained, [
        { file: stable, evidence: evidence(stable) },
      ]);
    };
    const ready = async (): Promise<void> => {
      if (process.platform === "win32" || process.platform === "darwin")
        await waitFor(
          () =>
            WATCH_BROKER.current !== undefined &&
            WATCH_BROKER.current.pendingRegistrations === 0,
          "native root subscription readiness",
        );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    };
    write();
    try {
      current.attach(server);
      register();
      await ready();
      fs.writeFileSync(input, "original control");
      await waitFor(
        () => notifications.has(owner),
        "original root native control",
      );
      notifications.clear();
      register();
      await TestProject.rename(project, moved);
      write();
      fs.writeFileSync(input, "original control");
      assert.ok(tick, "occupied project root owns a location poll");
      tick();
      assert.ok(
        !notifications.has(owner),
        "equal replacement bytes remain quiet",
      );
      fs.writeFileSync(input, "replacement edit");
      tick?.();
      await waitFor(
        () => notifications.has(owner),
        "replacement root fallback recovery",
      );
      assert.ok(
        !notifications.has(retained),
        "unchanged importer remains quiet",
      );
      notifications.clear();
      register();
      current.attach(server);
      await ready();
      fs.writeFileSync(path.join(moved, "stable.d.ts"), "old physical target");
      fs.writeFileSync(input, "same-root native control");
      await waitFor(
        () => notifications.has(owner),
        "same-root attachment native control without a poll tick",
      );
      assert.ok(
        !notifications.has(retained),
        "retired target cannot change the replacement's input",
      );
      notifications.clear();
      fs.writeFileSync(stable, "retained native control");
      await waitFor(
        () => notifications.has(retained),
        "overlapping importer retained through attachment",
      );
      await current.dispose();
      current = createViteServeInputWatch({
        poll(listener) {
          tick = listener;
          return {
            close: () => {
              tick = undefined;
            },
          };
        },
      });
      notifications.clear();
      current.attach(server);
      register();
      await ready();
      fs.writeFileSync(input, "fresh observer control");
      await waitFor(
        () => notifications.has(owner),
        "full disposal and fresh native reopen control",
      );
    } finally {
      await current.dispose();
    }
  } catch (error) {
    failures.push(
      new Error("project root native notification lifecycle", { cause: error }),
    );
  } finally {
    try {
      trace.record("vite-native-input-dispose", invocation, {
        pid: process.pid,
        data: { phase: "started" },
      });
      await watch.dispose();
      trace.record("vite-native-input-dispose", invocation, {
        pid: process.pid,
        data: { phase: "returned" },
      });
    } catch (error) {
      trace.record("vite-native-input-dispose", invocation, {
        pid: process.pid,
        data: { phase: "threw", error: String(error) },
      });
      prepared?.retain(
        "native Vite input observer disposal was not acknowledged",
      );
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "native Vite input watcher and closure");
}
