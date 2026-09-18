import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../packages/unplugin/lib/core/transform/watch/captureWatchInputBaseline.js";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";
import { loadViteAdapterPlugin } from "../../internal/adapter-vite-serve/loadViteAdapterPlugin";
import { waitFor } from "../../internal/adapter-vite-serve/waitFor";

/**
 * Exercise subscription races, lexical aliases and predicates on the real
 * watcher.
 */
export async function test_vite_compiler_watch_tracks_subscription_and_alias_boundaries(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-boundary-"),
  );
  const invalidated = new Set<string>();
  const watch = createViteServeInputWatch();
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
    fs.renameSync(
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
      const externalRoot = TestProject.tmpdir("ttsc-vite-watch-external-link-");
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
  } finally {
    await watch.dispose();
  }
  await assertExistingViteSubscriptionClosesCompileRace(root);
  await assertExternalViteSubscriptionClosesCompileRace(root);
  await assertViteHardlinkFallbackInvalidates(root);
  await assertViteCaseIdentityMemosReset(root);
  await assertViteDeletedImporterReleasesFallback(root);
}

/** An existing input must use its event witness when a new proof replaces it. */
async function assertExistingViteSubscriptionClosesCompileRace(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  let notify: ((eventType: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    watch(_scope, listener) {
      notify = listener;
      return { close: () => undefined };
    },
  });
  const importer = path.join(root, "existing-race.ts").replace(/\\/g, "/");
  const file = path.join(root, "existing-race.txt");
  const evidence = () => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    return {
      identity: baseline.identity,
      missing: false,
      state: { codec: "host" as const, hash: baseline.hostHash },
    };
  };
  fs.writeFileSync(file, "stable");
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(
      importer,
      [{ file, evidence: evidence() }],
      false,
      watch.begin(),
    );
    const startedAt = watch.begin();
    fs.writeFileSync(file, "transient");
    const transient = evidence();
    fs.writeFileSync(file, "stable");
    assert.ok(notify);
    notify("change", path.relative(root, file));
    watch.replace(importer, [{ file, evidence: transient }], false, startedAt);
    assert.ok(
      invalidated.has(importer),
      "an existing subscription must reject restored bytes observed during compilation",
    );
  } finally {
    await watch.dispose();
  }
}

/** A scope discovered after compilation must validate the uncovered interval. */
async function assertExternalViteSubscriptionClosesCompileRace(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  const watch = createViteServeInputWatch({
    watch() {
      return { close: () => undefined };
    },
  });
  const externalRoot = TestProject.tmpdir("ttsc-vite-watch-external-race-");
  const file = path.join(externalRoot, "value.txt");
  const importer = path.join(root, "external-race.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "before");
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    const startedAt = watch.begin();
    fs.writeFileSync(file, "after");
    watch.replace(
      importer,
      [
        {
          file,
          evidence: {
            identity: baseline.identity,
            missing: false,
            state: { codec: "host", hash: baseline.hostHash },
          },
        },
      ],
      false,
      startedAt,
    );
    assert.ok(
      invalidated.has(importer),
      "an external scope opened after compilation must reject the uncovered change",
    );
  } finally {
    await watch.dispose();
  }
}

/** A hardlink write outside every watched scope must use bounded polling. */
async function assertViteHardlinkFallbackInvalidates(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  let poll: (() => void) | undefined;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return { close: () => (poll = undefined) };
    },
    watch() {
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "hardlink-input.txt");
  const alias = path.join(
    TestProject.tmpdir("ttsc-vite-watch-hardlink-"),
    "hardlink-alias.txt",
  );
  const importer = path.join(root, "hardlink.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "before");
  fs.linkSync(file, alias);
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [
      {
        file,
        evidence: {
          identity: baseline.identity,
          missing: false,
          state: { codec: "host", hash: baseline.hostHash },
        },
      },
    ]);
    const tick = poll;
    assert.ok(tick, "a multiply linked input must enter the shared fallback");
    fs.writeFileSync(alias, "after");
    tick();
    assert.ok(
      invalidated.has(importer),
      "a write through an external hardlink must invalidate the importer",
    );
  } finally {
    await watch.dispose();
  }
}

/** A server restart must discard cached physical and case identity facts. */
async function assertViteCaseIdentityMemosReset(root: string): Promise<void> {
  let caseProbes = 0;
  let caseSensitive = true;
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    caseSensitive() {
      caseProbes += 1;
      return caseSensitive;
    },
    platform: "darwin",
    watch(_root, listener) {
      emit = listener;
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "case-memo", "input.txt");
  const importer = path.join(root, "case-memo.ts").replace(/\\/g, "/");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "value");
  const register = () => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    watch.attach({ config: { root } });
    watch.replace(importer, [
      {
        file,
        evidence: {
          identity: baseline.identity,
          missing: false,
          state: { codec: "host", hash: baseline.hostHash },
        },
      },
    ]);
  };

  register();
  const firstSessionProbes = caseProbes;
  assert.ok(firstSessionProbes > 0, "the simulated Darwin host must be probed");
  caseSensitive = false;
  emit?.("rename", file);
  assert.equal(
    caseProbes,
    firstSessionProbes,
    "a topology event must not switch the identity context underneath live path indexes",
  );
  await watch.dispose();
  register();
  try {
    assert.ok(
      caseProbes > firstSessionProbes,
      "a replacement server must rediscover case policy instead of retaining the old session's path cache",
    );
  } finally {
    await watch.dispose();
  }
}

/** Deleting an importer must release its private hardlink fallback state. */
async function assertViteDeletedImporterReleasesFallback(
  root: string,
): Promise<void> {
  const plugin = await loadViteAdapterPlugin();
  assert.equal(
    typeof plugin.watchChange,
    "function",
    "the published Vite adapter must forward source deletion to private input cleanup",
  );
  let poll: (() => void) | undefined;
  let closed = 0;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return {
        close() {
          poll = undefined;
          closed += 1;
        },
      };
    },
    watch() {
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "deleted-importer-input.txt");
  const alias = path.join(
    TestProject.tmpdir("ttsc-vite-watch-deleted-importer-"),
    "alias.txt",
  );
  const importer = path.join(root, "deleted-importer.ts").replace(/\\/g, "/");
  const survivor = path.join(root, "surviving-importer.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "value");
  fs.linkSync(file, alias);
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({ config: { root } });
  try {
    const input = {
      file,
      evidence: {
        identity: baseline.identity,
        missing: false as const,
        state: { codec: "host" as const, hash: baseline.hostHash },
      },
    };
    watch.replace(importer, [input]);
    watch.replace(survivor, [input]);
    assert.ok(poll, "a multiply linked input must own fallback work");
    watch.forget(importer);
    assert.ok(
      poll,
      "deleting one importer must retain fallback work owned by another importer",
    );
    assert.equal(closed, 0, "shared fallback work must remain open");
    watch.forget(survivor);
    assert.equal(
      poll,
      undefined,
      "a deleted importer must leave no fallback work",
    );
    assert.equal(
      closed,
      1,
      "the unused shared scheduler must close immediately",
    );
  } finally {
    await watch.dispose();
  }
  assert.equal(closed, 1, "server disposal must not re-close the scheduler");
}
