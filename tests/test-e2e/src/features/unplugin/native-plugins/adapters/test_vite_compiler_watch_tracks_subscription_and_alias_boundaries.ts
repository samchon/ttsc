import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../../../packages/unplugin/lib/core/transform/watch/captureWatchInputBaseline.js";
import { createViteServeInputWatch } from "../../../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";
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
 * 3. Dispose the actual watcher after file, directory and membership predicate
 *    transitions. Injected proof races, hardlink polling, identity-policy reset
 *    and importer cleanup execute in the source unit
 *    test_vite_compiler_watch_preserves_race_and_fallback_lifetimes.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual filesystem watcher invalidates changed importers while preserving unchanged aliases and file predicates across deletion before subscription, junction retargeting, ancestor rename, case spelling, external symlink and directory membership transitions.
 * @evidence contracts/testing.md#independent-expectations Authored filesystem transitions and literal predicate states define expected invalidation; host hash helper is used for baseline encoding, not expected callback sets.
 * @evidence contracts/testing.md#distinguishing-cases Deletion before subscribe, retargeted junction, ancestor rename, conditional case aliases, external symlink and directory/file/listing predicates. Source-unit proof races and resource ownership remain separate.
 * @evidence contracts/testing.md#execution-ownership The selected Vite DAG calls this body with upfront native-vite-watch and disjoint external coordinates. Its one actual watcher owns all cases above; it acquires real native subscriptions, not source-unit doubles or a separate Vite compiler/server.
 * @evidence contracts/e2e.md#necessary-boundary Real filesystem watcher events, junction retargeting, ancestor rename and external symlink writes connect native subscriptions to captured Vite invalidation. No native compiler or live Vite server is required for this notification boundary.
 * @evidence contracts/e2e.md#shared-execution One temporary filesystem corpus and one actual watcher serve all subscription, lexical-alias and predicate transitions. The source-unit race and fallback cases create no native watcher.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct importer identities and invalidation sets distinguish transitions within the shared watcher. watcher.dispose runs in finally; tracked roots end at process exit. Source-unit injected schedulers have their own final-owner close assertions.
 * @evidence contracts/e2e.md#preserved-coverage The actual watcher assertions above remain here. All 22 direct assertions in the five injected race, hardlink-poll, identity-policy and importer-release helpers execute unchanged in test_vite_compiler_watch_preserves_race_and_fallback_lifetimes through authored source APIs; its supported poll collaborators avoid native observers and real interval timers.
 */
export async function test_vite_compiler_watch_tracks_subscription_and_alias_boundaries(prepared?: {
  root: string;
  externalRoot: string;
  retain(reason: string): void;
}): Promise<void> {
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
  } finally {
    try {
      await watch.dispose();
    } catch (error) {
      prepared?.retain(
        "native Vite input observer disposal was not acknowledged",
      );
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "native Vite input watcher and closure");
}
