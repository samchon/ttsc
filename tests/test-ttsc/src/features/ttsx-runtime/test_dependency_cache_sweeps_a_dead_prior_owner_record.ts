import assert from "node:assert/strict";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Retains fresh manifest-less dependency-cache legacy sweep assembly.
 *
 * The fresh process owns the module's temp parent, private root and exit
 * callback. Local legacy owner records distinguish an actually exited PID from
 * this still-running process, without a compiler or installed runtime.
 *
 * @evidence contracts/testing.md#behavioral-verification A fresh Node process loads actual dependencyCacheRoot source through the existing unit loader, deletes TTSX_RUNTIME_MANIFEST and invokes dependencyCacheRoot({}). Original zero-exit, legacy dead-root absence and legacy live-root existence observations remain independent named assertions.
 * @evidence contracts/testing.md#independent-expectations Native seed completion status zero, null signal, positive PID and ESRCH-only signal-zero observation establish the departed input independently of the sweep; current PID is observed live. Literal hostname/PID owner.json records and process-PID-nonce directory names preserve the original legacy grammar. PID reuse remains a limitation, not process-incarnation proof.
 * @evidence contracts/testing.md#distinguishing-cases Same-host legacy records differ only in genuine departed/current owner state. A manifest-less fresh process exercises module-global parent/private-root initialization and sweep assembly, which supplied unowned-policy or descriptor-root units do not own. Modern/remote record decisions and guaranteed exit-callback reclamation are outside this contribution.
 * @evidence contracts/testing.md#execution-ownership This named source unit owns at most eight inert seed completions for ESRCH preparation and one fresh sweep process using actual production source hooks. Private HOME/TMP/cache variables and random names isolate native inputs without install, compiler/plugin build, product bootstrap, synthetic PID or foreign replacement. Spawn error/unknown completion retains the private root for unresolved child inputs; otherwise finally attempts root removal and aggregates cleanup failure. Selection/runtime and native outcomes are unverified by body existence.
 */
export function test_dependency_cache_sweeps_a_dead_prior_owner_record(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-legacy-owner-"));
  const failures: Error[] = [];
  let retainRoot = false;
  const observe = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    const home = path.join(root, "clean-process-home");
    const temporary = path.join(home, "tmp");
    fs.mkdirSync(temporary, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      LOCALAPPDATA: path.join(home, "AppData", "Local"),
      XDG_CACHE_HOME: path.join(home, "xdg"),
      TMPDIR: temporary,
      TEMP: temporary,
      TMP: temporary,
      TTSC_CACHE_DIR: "",
      TTSC_GO_CACHE_DIR: "",
      GOCACHE: "",
    };
    const departedPid = endedProcessId();
    process.kill(process.pid, 0);
    const parent = path.join(temporary, "ttsx-dep");
    const nonce = crypto.randomBytes(8).toString("hex");
    const dead = path.join(parent, `process-${departedPid}-${nonce}`);
    const live = path.join(parent, `process-${process.pid}-${nonce}`);
    for (const [directory, pid] of [
      [dead, departedPid],
      [live, process.pid],
    ] as const) {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "owner.json"),
        JSON.stringify({ hostname: os.hostname(), pid }),
        "utf8",
      );
    }
    const modulePath = fileURLToPath(
      new URL(
        "../../../../../packages/ttsc/src/launcher/internal/runtime/dependencyCacheRoot.ts",
        import.meta.url,
      ),
    );
    const loader = new URL(
      "../../../../../config/register-unit-loader.mjs",
      import.meta.url,
    ).href;
    const sweep = childProcess.spawnSync(
      process.execPath,
      [
        "--import",
        loader,
        "-e",
        `delete process.env.TTSX_RUNTIME_MANIFEST; require(${JSON.stringify(modulePath)}).dependencyCacheRoot({});`,
      ],
      {
        cwd: root,
        env,
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 64,
        timeout: 120_000,
        killSignal: "SIGKILL",
        windowsHide: true,
      },
    );
    if (
      sweep.error !== undefined ||
      (sweep.status === null && sweep.signal === null)
    )
      retainRoot = true;
    observe("fresh sweep launch", () => {
      assert.equal(sweep.error, undefined);
    });
    observe("fresh sweep signal", () => {
      assert.equal(sweep.signal, null, sweep.stderr);
    });
    observe("fresh sweep exits zero", () => {
      assert.equal(sweep.status, 0, sweep.stderr);
    });
    observe("legacy dead root removed", () => {
      assert.equal(fs.existsSync(dead), false, "the old dead root remained");
    });
    observe("legacy live root retained", () => {
      assert.equal(fs.existsSync(live), true, "the old live root was removed");
    });
  } catch (cause) {
    failures.push(
      new Error("legacy dependency owner native preparation", { cause }),
    );
  } finally {
    if (retainRoot)
      console.error("unresolved legacy dependency child inputs retained", root);
    else
      observe("legacy dependency root cleanup", () => {
        fs.rmSync(root, { recursive: true, force: true });
      });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "legacy dependency sweep observations failed",
    );

  function endedProcessId(): number {
    for (let attempt = 0; attempt < 8; attempt++) {
      const child = childProcess.spawnSync(process.execPath, ["-e", ""], {
        windowsHide: true,
        timeout: 30_000,
        killSignal: "SIGKILL",
      });
      if (
        child.error !== undefined ||
        (child.status === null && child.signal === null)
      )
        retainRoot = true;
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null, child.stderr?.toString());
      assert.equal(child.status, 0, child.stderr?.toString());
      assert.ok(Number.isInteger(child.pid) && child.pid > 0);
      try {
        process.kill(child.pid, 0);
      } catch (cause) {
        assert.ok(cause instanceof Error && "code" in cause);
        assert.equal(
          cause.code,
          "ESRCH",
          "departed PID absence must be observed",
        );
        return child.pid;
      }
    }
    throw new Error(
      "native preparation could not establish an absent owned child PID",
    );
  }
}
