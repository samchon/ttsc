import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { type ChildProcessWithoutNullStreams } from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { spawn } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { TtsgraphClient } from "../../../internal/graph/internal/ttsgraph";

const workerFixtures = path.resolve(
  import.meta.dirname,
  "../../../../fixtures/os/process-lifetime",
);

async function bounded<T>(
  promise: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function written(file: string): Promise<string> {
  const deadline = performance.now() + 10_000;
  while (performance.now() < deadline) {
    if (fs.existsSync(file)) {
      const value = fs.readFileSync(file, "utf8");
      if (/^[1-9]\d*\n$/.test(value)) return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Actual child did not publish readiness: ${file}`);
}

function actor(root: string, mode: string, hold: string) {
  const prepared = path.join(root, "process-fixtures");
  if (!fs.existsSync(prepared)) {
    fs.cpSync(workerFixtures, prepared, { recursive: true });
    E2eProcessTrace.fixturePaths(prepared, ["worker.cjs"]);
  }
  const worker = path.join(prepared, "worker.cjs");
  const ready = path.join(root, `${mode}.ready`);
  const identity = path.join(root, `${mode}.child`);
  const ended = path.join(root, `${mode}.ended`);
  const child = spawn(
    process.execPath,
    [worker, "resident", mode, ready, identity, ended, hold],
    {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  const exited = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  const client = TtsgraphClient.connect(child);
  return { child, client, closed, exited, ready, identity, ended };
}

async function observeDescendant(): Promise<{
  acquire(pid: number): Promise<void>;
  joined(): Promise<void>;
  close(): Promise<void>;
}> {
  if (process.platform !== "win32") {
    let pid = 0;
    return {
      async acquire(value) {
        pid = value;
      },
      async joined() {
        const deadline = performance.now() + 10_000;
        while (true) {
          try {
            process.kill(pid, 0);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ESRCH") return;
            throw error;
          }
          assert.ok(
            performance.now() < deadline,
            "Actual pipe holder remained alive",
          );
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      },
      async close() {},
    };
  }
  const child: ChildProcessWithoutNullStreams = spawn(
    path.join(
      process.env.SystemRoot!,
      "System32/WindowsPowerShell/v1.0/powershell.exe",
    ),
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "[Console]::WriteLine('ready'); $identity=[Console]::ReadLine(); if ($identity -eq $null) { exit 0 }; $p=Get-Process -Id ([int]$identity) -ErrorAction Stop; $handle=$p.Handle; [Console]::WriteLine('opened'); $p.WaitForExit(); [Console]::WriteLine('joined'); $p.Dispose()",
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  let stdout = "",
    stderr = "";
  let initialized!: () => void, acquired!: () => void;
  const initialization = new Promise<void>((resolve) => {
    initialized = resolve;
  });
  const acquisition = new Promise<void>((resolve) => {
    acquired = resolve;
  });
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    if (stdout.includes("ready")) initialized();
    if (stdout.includes("opened")) acquired();
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const completion = new Promise<void>((resolve, reject) => {
    const failed = (error: Error) => {
      initialized();
      acquired();
      reject(error);
    };
    child.once("error", failed);
    for (const stream of [child.stdin, child.stdout, child.stderr])
      stream.on("error", failed);
    child.once("close", (code, signal) => {
      initialized();
      acquired();
      if (code === 0 && signal === null && stdout.includes("joined")) resolve();
      else
        reject(
          new Error(
            `Process-handle observation failed: ${code}/${signal}: ${stderr}`,
          ),
        );
    });
  });
  const closed = new Promise<void>((resolve) =>
    child.once("close", () => resolve()),
  );
  void completion.catch(() => undefined);
  try {
    await bounded(
      initialization,
      30_000,
      "Process observer did not initialize",
    );
    assert.ok(stdout.includes("ready"));
  } catch (error) {
    const failures: unknown[] = [error];
    try {
      child.stdin.end();
    } catch (endError) {
      failures.push(endError);
    }
    try {
      await bounded(closed, 10_000, "Failed process observer did not close");
    } catch (cleanupError) {
      failures.push(cleanupError);
      try {
        child.kill();
      } catch (killError) {
        failures.push(killError);
      }
      try {
        await bounded(
          closed,
          10_000,
          "Failed process observer kill remained unjoined",
        );
      } catch (joinError) {
        failures.push(joinError);
      }
    }
    if (failures.length === 1) throw error;
    throw new AggregateError(
      failures,
      "Observer initialization and actual cleanup failed",
    );
  }
  return {
    async acquire(pid) {
      child.stdin.write(`${pid}\n`);
      await bounded(
        acquisition,
        10_000,
        "Process observer did not acquire its owned descendant",
      );
      assert.ok(stdout.includes("opened"), stderr);
    },
    joined: () => bounded(completion, 10_000, "Actual descendant did not join"),
    async close() {
      const failures: unknown[] = [];
      try {
        child.stdin.end();
      } catch (error) {
        failures.push(error);
      }
      try {
        await bounded(closed, 10_000, "Process observer stdio did not close");
      } catch (error) {
        failures.push(error);
        try {
          child.kill();
        } catch (killError) {
          failures.push(killError);
        }
        try {
          await bounded(
            closed,
            10_000,
            "Process observer termination remained unjoined",
          );
        } catch (joinError) {
          failures.push(joinError);
        }
      }
      try {
        await bounded(completion, 10_000, "Process observer did not close");
      } catch (error) {
        failures.push(error);
      }
      if (failures.length)
        throw new AggregateError(failures, "Process observer cleanup failed");
    },
  };
}

/**
 * Verifies the MCP test client's real process-and-stdio shutdown authority.
 *
 * The installed launcher uses this same stdio owner. A process exit alone must
 * not certify EOF while a descendant owns its pipes, and a finite wait must
 * reject without pretending the unjoined child completed.
 *
 * 1. Connect to a real cooperative Node actor and require zero-exit EOF.
 * 2. Connect to a real actor whose descendant retains stdout/stderr.
 * 3. Require the short wait to reject while those pipes remain open, forbid input
 *    mutation, then join the actual holder and all process handles.
 * 4. Collect both controls before reporting failures; no compiler frames are made.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual TtsgraphClient stdio owner joins cooperative zero-exit EOF; inherited pipes force a bounded rejection, retain unknown-reader authority and refuse input edits before the real descendant and process/stdio close are observed.
 * @evidence contracts/testing.md#independent-expectations Existing authored worker modes independently choose EOF zero or a 1,500ms pipe holder. A 100ms wait must reject within 1,000ms while its actual close remains pending; literal readiness PIDs and Windows process-handle or POSIX absence establish descendant identity and exit.
 * @evidence contracts/testing.md#distinguishing-cases Clean EOF contrasts an already-exited parent with live inherited stdio. This tests Node lifetime ownership without a graph snapshot, protocol response, fake compiler or injected private state.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, this named E2E scene connects actual spawned Node children through the same owner used by installed MCP startup. Existing shared OS actors are read directly; no native producer or product build is started for this scene.
 * @evidence contracts/e2e.md#necessary-boundary Kernel process/stdio closure and real EOF timing cannot be certified by an in-memory child declaration or a resolved promise.
 * @evidence contracts/e2e.md#shared-execution Both controls share one owned diagnostic root, current Node executable and the existing process-lifetime fixture family. Distinct clean and inherited lifetimes remain necessary; the Windows observer owns the actual holder's handle before EOF.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Readiness paths begin absent in an owned allocation. Unknown completion retains that root and rejects edits; teardown independently joins each actual child and descendant. Reclamation requires established joins and the allocation's original native root/ancestor realpaths, directory kinds, device/inode and birth times; failed joins or changed identities leave cleanup authority withheld. The actual controls establish stable-root success, not a filesystem-swap reproduction.
 * @evidence contracts/e2e.md#preserved-coverage Installed MCP cold escape/native acquisition and real native peer protocol coverage remain separate owners. This regression establishes only the test client's lifetime and failure authority and never substitutes Node actor output for native facts.
 */
export async function case_ttscgraph_mcp_client_joins_actual_transport_lifetimes(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-mcp-client-lifetime-");
  const physicalRoot = fs.realpathSync.native(root);
  const originalDirectories: {
    location: string;
    dev: number;
    ino: number;
    birthtimeMs: number;
  }[] = [];
  for (let location = physicalRoot; ; location = path.dirname(location)) {
    const stat = fs.lstatSync(location);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    originalDirectories.push({
      location,
      dev: stat.dev,
      ino: stat.ino,
      birthtimeMs: stat.birthtimeMs,
    });
    if (path.dirname(location) === location) break;
  }
  const failures: unknown[] = [];
  let joined = true,
    retained = false;
  const collect = async (name: string, body: () => Promise<void>) => {
    try {
      await body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  await collect("cooperative EOF", async () => {
    const owned = actor(root, "cooperative", "0");
    const primaryFailures: unknown[] = [];
    try {
      assert.equal(Number(await written(owned.ready)), owned.child.pid);
      owned.client.endStdin();
      assert.equal(await owned.client.waitForExit(5_000), 0);
      assert.equal(owned.client.inputsHaveUnconfirmedReaders(), false);
    } catch (error) {
      primaryFailures.push(error);
      throw error;
    } finally {
      const cleanup: unknown[] = [];
      try {
        owned.client.endStdin();
      } catch (error) {
        cleanup.push(error);
      }
      try {
        await bounded(owned.closed, 10_000, "Cooperative child did not close");
      } catch (error) {
        joined = false;
        cleanup.push(error);
        try {
          TestProject.retainTemporaryDirectory(
            root,
            "Cooperative MCP lifetime remained unjoined",
          );
          retained = true;
        } catch (retentionError) {
          cleanup.push(retentionError);
        }
      }
      if (cleanup.length)
        throw new AggregateError(
          [...primaryFailures, ...cleanup],
          "Cooperative assertions and cleanup failed",
        );
    }
  });
  await collect("inherited stdio deadline", async () => {
    const observer = await observeDescendant();
    const owned = actor(root, "pipe", "1500");
    const primaryFailures: unknown[] = [];
    let closed = false;
    void owned.closed.then(() => {
      closed = true;
    });
    try {
      assert.equal(Number(await written(owned.ready)), owned.child.pid);
      const pid = Number(await written(owned.identity));
      assert.ok(pid > 0 && pid !== process.pid && pid !== owned.child.pid);
      await observer.acquire(pid);
      owned.client.endStdin();
      assert.deepEqual(
        await bounded(
          owned.exited,
          5_000,
          "Pipe parent did not exit after EOF",
        ),
        { code: 0, signal: null },
        "The parent must have exited before testing descendant-held stdio",
      );
      const started = performance.now();
      await assert.rejects(
        owned.client.waitForExit(100),
        /did not exit within 100ms/,
      );
      const elapsed = performance.now() - started;
      assert.ok(
        elapsed < 1_000,
        `A 100ms deadline waited ${elapsed}ms for foreign stdio`,
      );
      assert.equal(closed, false, "Unknown completion was falsely joined");
      assert.equal(owned.client.inputsHaveUnconfirmedReaders(), true);
      assert.throws(
        () => owned.client.assertInputMutationAllowed(),
        /completion is unconfirmed/,
      );
      TestProject.retainTemporaryDirectory(
        root,
        "MCP transport deadline left inherited stdio unconfirmed",
      );
      retained = true;
    } catch (error) {
      primaryFailures.push(error);
      throw error;
    } finally {
      const cleanup: unknown[] = [];
      try {
        owned.client.endStdin();
      } catch (error) {
        cleanup.push(error);
      }
      const results = await Promise.allSettled([
        bounded(
          owned.closed,
          10_000,
          "Actual inherited process/stdio did not close",
        ),
        observer.joined(),
        observer.close(),
      ]);
      const joinErrors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      cleanup.push(...joinErrors);
      if (joinErrors.length) {
        joined = false;
        try {
          TestProject.retainTemporaryDirectory(
            root,
            "MCP actor or descendant completion remained unconfirmed",
          );
          retained = true;
        } catch (retentionError) {
          cleanup.push(retentionError);
        }
      }
      if (cleanup.length)
        throw new AggregateError(
          [...primaryFailures, ...cleanup],
          "Inherited stdio assertions and cleanup failed",
        );
    }
  });
  if (joined && retained) {
    try {
      assert.equal(fs.realpathSync.native(root), physicalRoot);
      assert.equal(path.isAbsolute(physicalRoot), true);
      for (const original of originalDirectories) {
        const current = fs.lstatSync(original.location);
        assert.ok(current.isDirectory() && !current.isSymbolicLink());
        assert.equal(
          fs.realpathSync.native(original.location),
          original.location,
        );
        assert.equal(current.dev, original.dev, original.location);
        assert.equal(current.ino, original.ino, original.location);
        assert.equal(
          current.birthtimeMs,
          original.birthtimeMs,
          original.location,
        );
      }
      fs.rmSync(physicalRoot, { recursive: true });
    } catch (error) {
      failures.push(
        new Error("Joined diagnostic root reclamation", { cause: error }),
      );
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "MCP stdio lifetime controls failed");
}
