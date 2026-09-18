import { TestProject } from "@ttsc/testing";

import {
  assert,
  child_process,
  fs,
  path,
  pruneGoBuildCacheRoot,
  resolvePluginCacheRoot,
  withGoBuildCacheLease,
} from "../../internal/source-build";

/**
 * Verifies Go object-cache LRU pruning yields to active builds and user caches.
 *
 * The ttsc-owned cache must converge toward its size target without deleting
 * objects under a concurrent Go build. An ambient `GOCACHE` remains wholly
 * user-owned and must not receive ttsc maintenance metadata or pruning.
 *
 * 1. Seed three old object files and prove an active build lease blocks GC.
 * 2. Release the lease, prune toward one object, and assert the newest survives.
 * 3. Seed four recent objects and assert the newest target-sized cohort is
 *    protected.
 * 4. Prove a future-dated GC marker cannot suppress maintenance after a clock
 *    rollback or restored cache, or mutate an external hard-linked file.
 * 5. Prove completed and stale intents cannot poison a live process, while a
 *    future-dated intent and fresh orphan lease retain a conservative grace.
 * 6. Deny Worker permission and prove the IPC heartbeat fallback cleans up its
 *    lease after running the callback.
 * 7. Reject cache-root and coordination-directory junctions without deleting their
 *    external objects or JSON files.
 * 8. Resolve user and explicitly named cache layouts and assert their objects and
 *    maintenance metadata remain untouched at the exact resolved roots.
 */
export const test_gobuildcache_prunes_lru_objects_outside_active_build_leases =
  () => {
    const root = TestProject.tmpdir("ttsc-go-cache-gc-");
    const goCache = path.join(root, "go-build");
    const now = Date.now();
    const files = [
      writeObject(goCache, "00", "old-a", now - 30_000),
      writeObject(goCache, "01", "old-b", now - 20_000),
      writeObject(goCache, "02", "newest", now - 10_000),
    ];
    const maintain = () =>
      pruneGoBuildCacheRoot(goCache, {
        force: true,
        maxBytes: 8,
        now,
        protectedAgeMs: 0,
        targetBytes: 4,
      });

    withGoBuildCacheLease(goCache, true, () => {
      maintain();
      assert.ok(files.every((file) => fs.existsSync(file)));
    });

    maintain();
    assert.equal(fs.existsSync(files[0]!), false);
    assert.equal(fs.existsSync(files[1]!), false);
    assert.equal(fs.existsSync(files[2]!), true);

    const recentCache = path.join(root, "recent-go-build");
    const recent = [
      writeObject(recentCache, "10", "recent-a", now - 4_000),
      writeObject(recentCache, "11", "recent-b", now - 3_000),
      writeObject(recentCache, "12", "recent-c", now - 2_000),
      writeObject(recentCache, "13", "recent-d", now - 1_000),
    ];
    pruneGoBuildCacheRoot(recentCache, {
      force: true,
      maxBytes: 12,
      now,
      protectedAgeMs: 60_000,
      targetBytes: 8,
    });
    assert.deepEqual(
      recent.map((file) => fs.existsSync(file)),
      [false, false, true, true],
    );

    const unevenCache = path.join(root, "uneven-recent-go-build");
    const uneven = [
      writeObject(unevenCache, "14", "old", now - 30_000),
      writeObject(unevenCache, "15", "recent-a", now - 2_000, "123456"),
      writeObject(unevenCache, "16", "recent-b", now - 1_000, "123456"),
    ];
    pruneGoBuildCacheRoot(unevenCache, {
      force: true,
      maxBytes: 8,
      now,
      protectedAgeMs: 60_000,
      targetBytes: 8,
    });
    assert.deepEqual(
      uneven.map((file) => fs.existsSync(file)),
      [false, false, true],
      "an uneven recent cohort must not overshoot its protection budget",
    );

    const futureMarkerCache = path.join(root, "future-marker-go-build");
    const futureMarkerObject = writeObject(
      futureMarkerCache,
      "14",
      "future-marker",
      now - 30_000,
    );
    const externalMarker = path.join(root, "external-go-cache-marker.txt");
    fs.writeFileSync(externalMarker, `${now + 24 * 60 * 60 * 1000}\n`, "utf8");
    fs.linkSync(externalMarker, path.join(futureMarkerCache, ".ttsc-gc"));
    pruneGoBuildCacheRoot(futureMarkerCache, {
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(futureMarkerObject), false);
    assert.equal(
      fs.readFileSync(externalMarker, "utf8"),
      `${now + 24 * 60 * 60 * 1000}\n`,
      "Go cache GC followed its marker outside the owned cache",
    );

    const staleIntent = writeCoordinationRecord(
      goCache,
      ".ttsc-maintenance",
      process.pid,
      now - 2 * 60 * 60 * 1000,
    );
    let staleIntentYielded = false;
    withGoBuildCacheLease(goCache, true, () => {
      staleIntentYielded = true;
    });
    assert.equal(staleIntentYielded, true);
    assert.equal(fs.existsSync(staleIntent), false);

    const completedCache = path.join(root, "completed-maintenance");
    const completedIntent = writeCoordinationRecord(
      completedCache,
      ".ttsc-maintenance",
      process.pid,
      now,
      "complete",
    );
    let completedIntentYielded = false;
    withGoBuildCacheLease(completedCache, true, () => {
      completedIntentYielded = true;
    });
    assert.equal(completedIntentYielded, true);
    assert.equal(fs.existsSync(completedIntent), false);

    const linkedLeaseCache = path.join(root, "linked-lease-record");
    const externalLease = path.join(root, "external-lease-record.json");
    let externalLeaseContents = "";
    withGoBuildCacheLease(linkedLeaseCache, true, () => {
      const leaseDirectory = path.join(linkedLeaseCache, ".ttsc-build-leases");
      const lease = path.join(
        leaseDirectory,
        fs.readdirSync(leaseDirectory)[0]!,
      );
      externalLeaseContents = fs.readFileSync(lease, "utf8");
      fs.linkSync(lease, externalLease);
    });
    assert.equal(
      fs.readFileSync(externalLease, "utf8"),
      externalLeaseContents,
      "lease completion rewrote an external hard-linked file",
    );

    const futureIntent = writeCoordinationRecord(
      goCache,
      ".ttsc-maintenance",
      process.pid,
      now + 24 * 60 * 60 * 1000,
    );
    const externalFutureIntent = path.join(root, "external-future-intent.json");
    const externalFutureContents = `${JSON.stringify({
      directoryName: ".ttsc-maintenance",
      hostname: "localhost",
      pid: process.pid,
      startedAt: now,
      status: "active",
      version: 1,
    })}\n`;
    fs.writeFileSync(externalFutureIntent, externalFutureContents, "utf8");
    const futureModified = new Date(now + 24 * 60 * 60 * 1000);
    fs.utimesSync(externalFutureIntent, futureModified, futureModified);
    const linkedFutureIntent = path.join(
      goCache,
      ".ttsc-maintenance",
      "external-future.json",
    );
    fs.linkSync(externalFutureIntent, linkedFutureIntent);
    const futureRelease = child_process.spawn(
      process.execPath,
      [
        "-e",
        [
          'const fs = require("node:fs");',
          "setTimeout(() => {",
          "  const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);",
          "  for (const file of process.argv.slice(1)) {",
          "    fs.utimesSync(file, stale, stale);",
          "  }",
          "}, 200);",
        ].join("\n"),
        futureIntent,
        linkedFutureIntent,
      ],
      { stdio: "ignore", windowsHide: true },
    );
    let futureIntentYielded = false;
    const futureWaitStarted = Date.now();
    withGoBuildCacheLease(goCache, true, () => {
      futureIntentYielded = true;
    });
    futureRelease.kill();
    assert.equal(futureIntentYielded, true);
    assert.ok(
      Date.now() - futureWaitStarted >= 150,
      "a future-dated intent must receive one conservative grace period",
    );
    assert.equal(fs.existsSync(futureIntent), false);
    assert.equal(fs.existsSync(linkedFutureIntent), false);
    assert.equal(
      fs.readFileSync(externalFutureIntent, "utf8"),
      externalFutureContents,
      "coordination recovery rewrote an external hard-linked file",
    );
    assert.equal(
      fs.statSync(externalFutureIntent).mtimeMs,
      futureModified.getTime(),
      "coordination recovery changed external hard-link metadata",
    );

    const linkedCoordinationCache = path.join(root, "linked-coordination");
    const outsideCoordination = path.join(root, "outside-coordination");
    fs.mkdirSync(linkedCoordinationCache, { recursive: true });
    fs.mkdirSync(outsideCoordination, { recursive: true });
    const outsideRecord = path.join(outsideCoordination, "keep.json");
    fs.writeFileSync(outsideRecord, "{}", "utf8");
    const outsideStale = new Date(now - 2 * 60 * 60 * 1000);
    fs.utimesSync(outsideRecord, outsideStale, outsideStale);
    fs.symlinkSync(
      outsideCoordination,
      path.join(linkedCoordinationCache, ".ttsc-maintenance"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () => withGoBuildCacheLease(linkedCoordinationCache, true, () => {}),
      /unsafe Go build cache coordination directory/,
    );
    assert.equal(
      fs.existsSync(outsideRecord),
      true,
      "coordination cleanup escaped through a junction",
    );

    const linkedRootCache = path.join(root, "linked-root");
    const outsideRootCache = path.join(root, "outside-root");
    const outsideObject = writeObject(
      outsideRootCache,
      "aa",
      "keep-a",
      now - 30_000,
    );
    fs.symlinkSync(
      outsideRootCache,
      linkedRootCache,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(
      () => withGoBuildCacheLease(linkedRootCache, true, () => {}),
      /unsafe Go build cache root/,
    );
    pruneGoBuildCacheRoot(linkedRootCache, {
      force: true,
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(
      fs.existsSync(outsideObject),
      true,
      "Go cache GC escaped through a root junction",
    );

    const orphanCache = path.join(root, "orphan-go-build");
    const orphanObject = writeObject(
      orphanCache,
      "20",
      "orphan-protected",
      now - 30_000,
    );
    const orphanLease = writeCoordinationRecord(
      orphanCache,
      ".ttsc-build-leases",
      2_147_483_647,
      now,
    );
    pruneGoBuildCacheRoot(orphanCache, {
      force: true,
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(orphanObject), true);
    const expired = new Date(now - 2 * 60 * 60 * 1000);
    fs.utimesSync(orphanLease, expired, expired);
    pruneGoBuildCacheRoot(orphanCache, {
      force: true,
      maxBytes: 0,
      now,
      protectedAgeMs: 0,
      targetBytes: 0,
    });
    assert.equal(fs.existsSync(orphanObject), false);

    if (process.allowedNodeEnvironmentFlags.has("--permission")) {
      const permissionCache = path.join(root, "permission-heartbeat");
      const permissionMarker = path.join(root, "permission-callback.txt");
      const library = path.join(
        TestProject.WORKSPACE_ROOT,
        "packages",
        "ttsc",
        "lib",
        "plugin",
        "internal",
        "source",
        "withGoBuildCacheLease.js",
      );
      const permissionRun = child_process.spawnSync(
        process.execPath,
        [
          "--permission",
          "--allow-fs-read=*",
          "--allow-fs-write=*",
          "--allow-child-process",
          "-e",
          [
            'const fs = require("node:fs");',
            "const { withGoBuildCacheLease } = require(process.argv[1]);",
            "withGoBuildCacheLease(process.argv[2], true, () => {",
            '  fs.writeFileSync(process.argv[3], "ran\\n", "utf8");',
            "});",
          ].join("\n"),
          library,
          permissionCache,
          permissionMarker,
        ],
        { encoding: "utf8" },
      );
      assert.equal(
        permissionRun.status,
        0,
        `${permissionRun.stdout}\n${permissionRun.stderr}`,
      );
      assert.equal(fs.readFileSync(permissionMarker, "utf8"), "ran\n");
      assert.deepEqual(
        fs.readdirSync(path.join(permissionCache, ".ttsc-build-leases")),
        [],
      );
    }

    const project = path.join(root, "project");
    fs.mkdirSync(path.join(project, "node_modules"), { recursive: true });
    const userCache = path.join(root, "user-gocache");
    const userObject = writeObject(userCache, "03", "user", now - 30_000);
    resolvePluginCacheRoot(project, undefined, { GOCACHE: userCache });
    assert.equal(fs.existsSync(userObject), true);
    assert.equal(fs.existsSync(path.join(userCache, ".ttsc-gc")), false);
    assert.equal(
      fs.existsSync(path.join(userCache, ".ttsc-maintenance")),
      false,
    );

    for (const layout of [
      {
        cacheDir: path.join(root, "explicit-cache-dir"),
        goBuildRoot: path.join(root, "explicit-cache-dir", "go-build"),
        env: {},
        label: "cache-dir",
      },
      {
        cacheDir: undefined,
        goBuildRoot: path.join(root, "explicit-env-cache", "go-build"),
        env: { TTSC_CACHE_DIR: path.join(root, "explicit-env-cache") },
        label: "TTSC_CACHE_DIR",
      },
      {
        cacheDir: undefined,
        goBuildRoot: path.join(root, "explicit-go-cache"),
        env: { TTSC_GO_CACHE_DIR: path.join(root, "explicit-go-cache") },
        label: "TTSC_GO_CACHE_DIR",
      },
    ]) {
      const object = writeObject(
        layout.goBuildRoot,
        "04",
        layout.label,
        now - 30_000,
      );
      resolvePluginCacheRoot(project, layout.cacheDir, layout.env);
      assert.equal(fs.existsSync(object), true);
      assert.equal(
        fs.existsSync(path.join(layout.goBuildRoot, ".ttsc-gc")),
        false,
      );
    }
  };

function writeCoordinationRecord(
  root: string,
  directoryName: string,
  pid: number,
  mtimeMs: number,
  status: "active" | "complete" = "active",
): string {
  const directory = path.join(root, directoryName);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `synthetic-${pid}.json`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({
      directoryName,
      hostname: "localhost",
      pid,
      startedAt: mtimeMs,
      status,
      version: 1,
    })}\n`,
    "utf8",
  );
  const modified = new Date(mtimeMs);
  fs.utimesSync(file, modified, modified);
  return file;
}

function writeObject(
  root: string,
  bucket: string,
  name: string,
  mtimeMs: number,
  contents: string = "data",
): string {
  const directory = path.join(root, bucket);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, name);
  fs.writeFileSync(file, contents, "utf8");
  const modified = new Date(mtimeMs);
  fs.utimesSync(file, modified, modified);
  return file;
}
