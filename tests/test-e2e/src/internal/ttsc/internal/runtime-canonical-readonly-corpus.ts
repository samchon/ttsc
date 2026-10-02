import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { resolveSourceBuildCachePaths } from "../../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { denyWrites, runsAsRoot } from "./read-only-directory";

type Inputs = Readonly<Record<string, string>>;
type Phase = {
  name: string;
  state: "PASS" | "FAIL" | "BLOCKED";
  failures: Error[];
  hosts: {
    name: string;
    status: number | null;
    signal: NodeJS.Signals | null;
    pid: number;
    error?: Error;
    stdout: string;
    stderr: string;
  }[];
};

/**
 * Borrow one canonical root only after all earlier child close receipts settle.
 * Two original immutable fixture populations retain their exact configurations
 * and bytes. Holding both src and node_modules prevents unrelated static
 * imports and a writable existing local cache from masking the native
 * permission case. The default phase creates an owned EMPTY installation
 * boundary and denies creation in both root and boundary; no ancestor
 * permission is changed. Its actual cache resolver must select that boundary or
 * setup remains BLOCKED.
 *
 * Inputs will be authored canonical profile files, not compiler predictions.
 * Root execution returns false with behavioral coverage zero. Other missing
 * prerequisites are BLOCKED failures, never successful permission observations.
 * The known native write refusal precedes every host; all three commands retain
 * their original arguments and literal assertions. Windows deny/restore may
 * additionally start icacls processes; these are not compiler preparations.
 * Normal Windows denial/restoration needs six ACL calls: four original root
 * calls plus two added boundary calls. Fault-only recovery calls remain extra.
 * safeForCleanup requires verified permissions, returned original inputs and
 * ordinary host termination; failure receipts remain even after recovery.
 * Uncertain termination is latched before another request: later source moves,
 * profile staging and graph restoration stop, and the exact owned allocation
 * transfers out of exit cleanup. Native deny overlays still release in finally
 * because changing those owned ACL/mode settings does not move a live source.
 * Probe removal requires this invocation's exclusive FD and retained identity.
 *
 * @evidence contracts/common.md#principled-implementation Genuine denied root-entry creation distinguishes native default-cache fallback from excluded-entry temporary-config refusal; unchanged original project options and source bytes select each actual compile.
 * @evidence contracts/common.md#clear-and-simple-design Two sequential input populations borrow one joined canonical root and return phase and host receipts; verified completion restores the original graph, while unresolved processes retain both current and held original inputs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing native denyWrites is called directly; no fabricated filesystem error, compiler output, test host or global environment replacement supplies the result.
 * @evidence contracts/common.md#meaningful-documentation Describes joined-reader ownership, exact profile bytes, held input state, capability-zero coverage and native ACL process distinctions.
 * @evidence contracts/portability.md#os-neutral-implementation Native absolute paths bound each rename and write; POSIX original mode and Windows invocation-owned deny rule are restored and real write probes verify effective access.
 * @evidence contracts/performance.md#efficient-algorithms Finite profile copying writes C total input bytes; path and top-level entry observations process E entries and B path characters, with O(E log E * L) sorting comparisons of at most L characters. Three original host requests retain their native compiler work, which is not assigned a constant runtime cost.
 * @evidence contracts/performance.md#reuse-equivalent-work Installed tool artifacts and one completed consumer root are reused; different strict/configuration and excluded/include decisions retain separate original host requests instead of cached result substitution.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Prior close receipts settle before moves. Every launcher receipt must have no error, a normal status, no signal and a positive PID before another request or source transition. Finally releases only owned permission overlays; verified resource and process completion permits original-input restoration, while unresolved roots transfer out of exit cleanup. Recovery retains failures instead of claiming initial success.
 * @evidence contracts/testing.md#behavioral-verification Real native denial brackets default included execution and same-directory excluded failure/included success; literal statuses, stdout, actionable stderr and path population are observed after completed commands.
 * @evidence contracts/testing.md#independent-expectations The original fixture bytes and literals read-only-ran, included-ran, outside-ran, status2 and remedy text are independent of runtime output; a before-host actual root-name population owns the preservation oracle.
 * @evidence contracts/testing.md#distinguishing-cases Default cache versus explicit cache and excluded versus included sources remain three actual hosts. Privileged root skips with coverage zero; invalid permissions or cache prerequisites are BLOCKED failures.
 * @evidence contracts/testing.md#execution-ownership The discoverable canonical parent supplies immutable authored profiles and completed-reader receipts, collects the returned phase failures, and owns native tool installation and root cleanup; this helper registers no hidden test host.
 * @evidence contracts/e2e.md#necessary-boundary Actual permission enforcement, native compilation and Node entry execution must remain connected; the exported cache resolver is used only to reject an invalid setup, never to assert successful fallback.
 * @evidence contracts/e2e.md#shared-execution Two original readonly projects reuse one canonical root sequentially while all three real launcher lifetimes and distinct native preparation needs remain; Windows ACL commands are additional native OS operations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Both source and node_modules are held only after earlier readers finish; exact profile bytes are staged separately. Verified completion preserves unexpected outputs and returns original inputs without recursive deletion. Uncertain hosts forbid input moves and retain the exact allocated root; owned permission overlays still restore and exclusively owned probes verify access.
 * @evidence contracts/e2e.md#preserved-coverage Original default status/marker/root names and excluded status/path/remedy/no-run plus included status/marker remain; additional denial and restoration controls do not certify unsupported hosts or unmeasured compiler descendants.
 */
export async function runCanonicalReadonlyCorpus(
  root: string,
  inputs: { defaultCache: Inputs; excludedEntry: Inputs },
  earlierChildrenClosed: readonly Promise<void>[],
): Promise<
  { phases: Phase[]; failures: Error[]; safeForCleanup: boolean } | false
> {
  if (runsAsRoot()) return false;
  const prior = await Promise.allSettled(earlierChildrenClosed);
  const unjoined = prior.filter((result) => result.status === "rejected");
  if (unjoined.length)
    throw new AggregateError(
      unjoined,
      "BLOCKED: earlier children did not close successfully",
    );
  const ownedRoot = fs.realpathSync.native(root);
  assert.ok(fs.statSync(ownedRoot).isDirectory());
  assert.notEqual(
    ownedRoot,
    path.parse(ownedRoot).root,
    "a filesystem root is not a canonical project",
  );
  for (const item of ["src", "node_modules", "package.json", "tsconfig.json"])
    assert.equal(
      fs.existsSync(path.join(ownedRoot, item)),
      true,
      "completed canonical input required: " + item,
    );
  const held = path.join(ownedRoot, "readonly-held");
  assert.equal(
    fs.existsSync(held),
    false,
    "readonly staging must own a fresh name",
  );
  const original = path.join(held, "original");
  const evidence = path.join(held, "observed");
  const cache = path.join(held, "explicit-cache");
  fs.mkdirSync(original, { recursive: true });
  fs.mkdirSync(evidence);
  fs.mkdirSync(cache);
  const backup: string[] = [];
  const failures: Error[] = [];
  const phases: Phase[] = [];
  let safeForCleanup = true;
  let hostsJoined = true;
  let stableNames: Set<string>;
  const owns = (location: string): void => {
    const relative = path.relative(ownedRoot, path.resolve(location));
    assert.ok(
      relative !== "" &&
        relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative),
      "move/write must stay within the owned absolute root",
    );
  };
  const move = (from: string, to: string): void => {
    owns(from);
    owns(to);
    assert.equal(fs.existsSync(to), false, "move destination must be fresh");
    fs.renameSync(from, to);
  };
  const collect = (phase: Phase, label: string, work: () => void): void => {
    try {
      work();
    } catch (cause) {
      phase.failures.push(new Error(label, { cause }));
    }
  };
  const preserveStaged = (name: string): void => {
    // Unexpected output entries are retained as observations, not deleted to
    // make restoration or a later phase appear successful.
    for (const item of fs.readdirSync(ownedRoot))
      if (!stableNames.has(item) && item !== "readonly-write-probe")
        move(
          path.join(ownedRoot, item),
          path.join(evidence, name + "-" + item),
        );
  };
  const phase = (name: string, files: Inputs, defaultCache: boolean): void => {
    const record: Phase = { name, state: "BLOCKED", failures: [], hosts: [] };
    phases.push(record);
    if (!safeForCleanup || !hostsJoined) {
      const blocked = new Error(
        "BLOCKED: prior readonly runtime or resource has no safe transition",
      );
      record.failures.push(blocked);
      failures.push(blocked);
      return;
    }
    // A thrown launcher supplies no completed receipt. Latch that uncertainty
    // at the actual call boundary before another request or input transition.
    const launch = (name: string, args: string[]) => {
      assert.equal(
        hostsJoined,
        true,
        "BLOCKED: prior native host has no completion",
      );
      hostsJoined = false;
      let result: ReturnType<typeof TestProject.spawn>;
      try {
        result = TestProject.spawn(TestProject.TTSX_BIN, args, {
          cwd: ownedRoot,
        });
      } catch (cause) {
        safeForCleanup = false;
        throw cause;
      }
      // Classify the actual returned process at this one owning boundary;
      // neither another launcher nor a source transition can precede it.
      hostsJoined = isOrdinarilyClosedReadonlyLauncher(result);
      if (!hostsJoined) {
        safeForCleanup = false;
        record.failures.push(
          new Error("Unresolved readonly native request", {
            cause:
              result.error ??
              new Error(
                "status=" +
                  result.status +
                  ", signal=" +
                  result.signal +
                  ", pid=" +
                  result.pid,
              ),
          }),
        );
      }
      record.hosts.push({
        name,
        status: result.status,
        signal: result.signal,
        pid: result.pid,
        error: result.error,
        stdout: result.stdout,
        stderr: result.stderr,
      });
      return result;
    };
    let restore: (() => void) | undefined;
    let restoreBoundary: (() => void) | undefined;
    let denyAttempted = false;
    let boundaryDenyAttempted = false;
    let originalMode: number | undefined;
    let boundaryOriginalMode: number | undefined;
    let rootPermissionSafe = true;
    let boundaryPermissionSafe = true;
    let denied = false;
    const probe = path.join(ownedRoot, "readonly-write-probe");
    const boundary = path.join(ownedRoot, "node_modules");
    const boundaryProbe = path.join(boundary, "readonly-boundary-probe");
    let boundaryProbeOwned = false;
    let boundaryProbeIdentity: { dev: bigint; ino: bigint } | undefined;
    const writeBoundaryProbe = (contents: string): void => {
      assert.equal(boundaryProbeOwned, false);
      const descriptor = fs.openSync(boundaryProbe, "wx");
      boundaryProbeOwned = true;
      try {
        const identity = fs.fstatSync(descriptor, { bigint: true });
        boundaryProbeIdentity = { dev: identity.dev, ino: identity.ino };
        fs.writeFileSync(descriptor, contents, "utf8");
      } finally {
        fs.closeSync(descriptor);
      }
    };
    const removeBoundaryProbe = (): void => {
      if (!boundaryProbeOwned) return;
      assert.ok(boundaryProbeIdentity);
      const current = fs.lstatSync(boundaryProbe, { bigint: true });
      assert.equal(
        current.isFile(),
        true,
        "a replaced boundary probe is not owned",
      );
      assert.equal(current.dev, boundaryProbeIdentity.dev);
      assert.equal(current.ino, boundaryProbeIdentity.ino);
      fs.unlinkSync(boundaryProbe);
      boundaryProbeOwned = false;
      boundaryProbeIdentity = undefined;
    };
    let probeOwned = false;
    let probeIdentity: { dev: bigint; ino: bigint } | undefined;
    const writeOwnedProbe = (contents: string): void => {
      assert.equal(probeOwned, false, "prior owned probe must be released");
      const descriptor = fs.openSync(probe, "wx");
      probeOwned = true;
      try {
        const identity = fs.fstatSync(descriptor, { bigint: true });
        probeIdentity = { dev: identity.dev, ino: identity.ino };
        fs.writeFileSync(descriptor, contents, "utf8");
      } finally {
        fs.closeSync(descriptor);
      }
    };
    const removeOwnedProbe = (): void => {
      if (!probeOwned) return;
      assert.ok(probeIdentity, "probe creation identity must be retained");
      const current = fs.lstatSync(probe, { bigint: true });
      assert.equal(current.isFile(), true, "a replaced probe is not owned");
      assert.equal(
        current.dev,
        probeIdentity.dev,
        "probe device identity changed",
      );
      assert.equal(
        current.ino,
        probeIdentity.ino,
        "probe inode identity changed",
      );
      fs.unlinkSync(probe);
      probeOwned = false;
      probeIdentity = undefined;
    };
    const probeExists = (): boolean => {
      try {
        fs.lstatSync(probe);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    };
    try {
      const expected = defaultCache
        ? ["package.json", "src/main.ts", "tsconfig.json"]
        : ["clear.ts", "package.json", "src/main.ts", "tsconfig.json"];
      assert.deepEqual(
        Object.keys(files).sort(),
        expected.sort(),
        "exact original input population required",
      );
      for (const item of [
        "src",
        "node_modules",
        "package.json",
        "tsconfig.json",
        "clear.ts",
      ])
        assert.equal(
          fs.existsSync(path.join(ownedRoot, item)),
          false,
          "prior staged population must have been preserved: " + item,
        );
      for (const [file, contents] of Object.entries(files)) {
        const location = path.join(ownedRoot, file);
        owns(location);
        fs.mkdirSync(path.dirname(location), { recursive: true });
        fs.writeFileSync(location, contents, "utf8");
      }
      assert.equal(
        fs.existsSync(path.join(ownedRoot, "node_modules")),
        false,
        "default fallback must not find a writable existing local cache",
      );
      if (defaultCache) {
        owns(boundary);
        fs.mkdirSync(boundary);
        assert.deepEqual(
          fs.readdirSync(boundary),
          [],
          "owned installation boundary must start empty",
        );
        assert.equal(
          Boolean(process.env.TTSC_CACHE_DIR),
          false,
          "BLOCKED: ambient cache override would suppress the production fallback branch",
        );
        assert.equal(
          resolveSourceBuildCachePaths(ownedRoot, undefined, process.env).root,
          path.join(ownedRoot, "node_modules", ".cache", "ttsc"),
          "BLOCKED: an ancestor installation boundary would bypass denied root entry creation",
        );
      }
      const before = fs.readdirSync(ownedRoot).sort();
      assert.equal(
        probeExists(),
        false,
        "permission probe must own a fresh name",
      );
      originalMode = fs.statSync(ownedRoot).mode;
      denyAttempted = true;
      rootPermissionSafe = false;
      restore = denyWrites(ownedRoot);
      if (defaultCache) {
        boundaryOriginalMode = fs.statSync(boundary).mode;
        boundaryDenyAttempted = true;
        boundaryPermissionSafe = false;
        restoreBoundary = denyWrites(boundary);
        let boundaryDenied = false;
        try {
          writeBoundaryProbe("probe");
        } catch (error) {
          if (
            boundaryProbeOwned ||
            !["EACCES", "EPERM", "EROFS"].includes(
              (error as NodeJS.ErrnoException).code ?? "",
            )
          )
            throw error;
          boundaryDenied = true;
        }
        assert.equal(
          boundaryDenied,
          true,
          "BLOCKED: owned installation boundary did not refuse a new cache entry",
        );
      }
      try {
        writeOwnedProbe("probe");
      } catch (error) {
        if (
          !["EACCES", "EPERM", "EROFS"].includes(
            (error as NodeJS.ErrnoException).code ?? "",
          )
        )
          throw error;
        if (probeOwned) throw error;
        denied = true;
      }
      assert.equal(
        denied,
        true,
        "BLOCKED: native permissions did not refuse a new root entry",
      );
      record.state = "PASS";
      if (defaultCache) {
        collect(record, "default request", () => {
          const result = launch("default", ["--cwd", ownedRoot, "src/main.ts"]);
          collect(record, "default status", () =>
            assert.equal(result.status, 0, result.stderr),
          );
          collect(record, "default marker", () =>
            assert.equal(result.stdout.trim(), "read-only-ran"),
          );
        });
      } else {
        collect(record, "excluded request", () => {
          const outside = launch("excluded", [
            "--cwd",
            ownedRoot,
            "--cache-dir",
            cache,
            "clear.ts",
          ]);
          collect(record, "excluded status", () =>
            assert.equal(outside.status, 2, outside.stdout),
          );
          collect(record, "excluded directory refusal", () =>
            assert.match(outside.stderr, /is not writable/),
          );
          collect(record, "excluded actual directory", () =>
            assert.ok(outside.stderr.includes(ownedRoot), outside.stderr),
          );
          collect(record, "excluded remedy", () =>
            assert.match(outside.stderr, /"include" or "files"/),
          );
          collect(record, "excluded did not run", () =>
            assert.doesNotMatch(outside.stdout, /outside-ran/),
          );
        });
        collect(record, "included request", () => {
          const included = launch("included", [
            "--cwd",
            ownedRoot,
            "--cache-dir",
            cache,
            "src/main.ts",
          ]);
          collect(record, "included status", () =>
            assert.equal(included.status, 0, included.stderr),
          );
          collect(record, "included marker", () =>
            assert.equal(included.stdout.trim(), "included-ran"),
          );
        });
      }
      collect(record, "unchanged top-level population", () =>
        assert.deepEqual(fs.readdirSync(ownedRoot).sort(), before),
      );
    } catch (cause) {
      record.failures.push(
        new Error(record.state === "BLOCKED" ? "BLOCKED: " + name : name, {
          cause,
        }),
      );
    } finally {
      const restoreOwnBoundaryDeniedState = (): void => {
        if (!boundaryDenyAttempted) return;
        if (process.platform === "win32") {
          const repaired = spawnSync(
            "icacls",
            [boundary, "/remove:d", "*S-1-1-0"],
            { encoding: "utf8" },
          );
          assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);
        } else if (boundaryOriginalMode !== undefined)
          fs.chmodSync(boundary, boundaryOriginalMode);
      };
      const probeBoundaryRestored = (): void => {
        if (!boundaryDenyAttempted) return;
        removeBoundaryProbe();
        writeBoundaryProbe("restored");
        assert.equal(fs.readFileSync(boundaryProbe, "utf8"), "restored");
        removeBoundaryProbe();
      };
      try {
        if (restoreBoundary !== undefined) restoreBoundary();
        else restoreOwnBoundaryDeniedState();
      } catch (cause) {
        record.failures.push(
          new Error("native boundary permission restoration", { cause }),
        );
      }
      try {
        probeBoundaryRestored();
        boundaryPermissionSafe = true;
      } catch (cause) {
        record.failures.push(
          new Error("restored boundary write probe", { cause }),
        );
        try {
          restoreOwnBoundaryDeniedState();
          probeBoundaryRestored();
          boundaryPermissionSafe = true;
        } catch (recovery) {
          record.failures.push(
            new Error("native boundary permission recovery", {
              cause: recovery,
            }),
          );
        }
      }
      const restoreOwnDeniedState = (): void => {
        if (!denyAttempted) return;
        if (process.platform === "win32") {
          const repaired = spawnSync(
            "icacls",
            [ownedRoot, "/remove:d", "*S-1-1-0"],
            { encoding: "utf8" },
          );
          assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);
        } else if (originalMode !== undefined)
          fs.chmodSync(ownedRoot, originalMode);
      };
      const probeRestored = (): void => {
        if (!denyAttempted) return;
        removeOwnedProbe();
        writeOwnedProbe("restored");
        assert.equal(fs.readFileSync(probe, "utf8"), "restored");
        removeOwnedProbe();
      };
      try {
        if (restore !== undefined) restore();
        else restoreOwnDeniedState();
      } catch (cause) {
        record.failures.push(
          new Error("native permission restoration", { cause }),
        );
      }
      try {
        probeRestored();
        rootPermissionSafe = true;
      } catch (cause) {
        record.failures.push(
          new Error("restored native write probe", { cause }),
        );
        // Resource recovery cannot erase the recorded restoration failure.
        // This removes only this invocation's deny rule or restores its saved
        // POSIX mode before the borrowed graph is returned to the caller.
        try {
          restoreOwnDeniedState();
          probeRestored();
          rootPermissionSafe = true;
        } catch (recovery) {
          record.failures.push(
            new Error("native permission recovery", { cause: recovery }),
          );
        }
      }
      try {
        if (hostsJoined && rootPermissionSafe && boundaryPermissionSafe)
          preserveStaged(name);
      } catch (cause) {
        safeForCleanup = false;
        record.failures.push(
          new Error("preserve staged source observations", { cause }),
        );
      }
      if (record.state !== "BLOCKED" && record.failures.length)
        record.state = "FAIL";
      safeForCleanup &&=
        hostsJoined && rootPermissionSafe && boundaryPermissionSafe;
      failures.push(...record.failures);
    }
  };
  try {
    for (const item of [
      "src",
      "node_modules",
      "package.json",
      "tsconfig.json",
      "clear.ts",
    ]) {
      const from = path.join(ownedRoot, item);
      if (fs.existsSync(from)) {
        move(from, path.join(original, item));
        backup.push(item);
      }
    }
    stableNames = new Set(fs.readdirSync(ownedRoot));
    phase("default-cache", inputs.defaultCache, true);
    phase("excluded-entry", inputs.excludedEntry, false);
  } catch (cause) {
    failures.push(new Error("BLOCKED: canonical input staging", { cause }));
    for (const name of ["default-cache", "excluded-entry"])
      if (!phases.some((record) => record.name === name))
        phases.push({ name, state: "BLOCKED", failures: [], hosts: [] });
  } finally {
    for (const item of safeForCleanup && hostsJoined ? backup : []) {
      try {
        move(path.join(original, item), path.join(ownedRoot, item));
      } catch (cause) {
        safeForCleanup = false;
        failures.push(new Error("restore canonical " + item, { cause }));
      }
    }
  }
  if (
    phases.some((record) =>
      record.hosts.some((host) => host.status === null || host.signal !== null),
    )
  )
    safeForCleanup = false;
  if (!safeForCleanup) {
    try {
      TestProject.retainTemporaryDirectory(
        root,
        "Readonly runtime completion or resource restoration unresolved; staged and held original inputs must survive exit cleanup",
      );
    } catch (cause) {
      failures.push(
        new Error("Retain canonical readonly root " + root, { cause }),
      );
    }
  }
  return { phases, failures, safeForCleanup };
}
