import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "./E2eProcessTrace";
import { TestProject } from "./TestProject";

/**
 * Test-only enrollment in original kernel process lifetimes. Numeric PIDs are
 * used once for enrollment while the authored target is held live; subsequent
 * retirement checks use the native observer's retained handle, pidfd or knote.
 *
 * @evidence contracts/common.md#principled-implementation A session binds each acquired target to a retained kernel lifetime and verifies every nonce/request/target acknowledgement; wait never looks up a numeric PID again.
 * @evidence contracts/common.md#clear-and-simple-design Preparation owns the isolated Go fixture and immutable binary reading; a session owns protocol requests and close/join, while callers own product cancellation and fixture retention.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No product hook or foreign primitive is replaced. Protocol errors cannot become retirement success, and no numeric PID absence fallback exists.
 * @evidence contracts/common.md#meaningful-documentation Describes enrollment timing, original lifetime authority, preparation identity and caller cleanup obligations.
 * @evidence contracts/portability.md#os-neutral-implementation The isolated native fixture owns Windows handles, Linux pidfds and Darwin kqueue registrations; TypeScript validates their explicit platform/kernel identity without treating it as a new lookup authority.
 * @evidence contracts/performance.md#efficient-algorithms Protocol routing uses request and target maps; preparation hashes actual fixture bytes and the executable, with storage proportional to the fixture and enrolled targets.
 * @evidence contracts/performance.md#reuse-equivalent-work One preparation per process reuses only identical selected binary/source readings; each session and enrolled process lifetime remains distinct.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Session close awaits native resource release and actual observer exit. Five seconds without graceful close triggers retention and an owned-process kill request; it does not certify a bounded join if OS completion remains unknown. Preparation allocations are exit-tracked, and retained ones cannot be reused.
 */
export namespace NativeProcessObserver {
  let shared: PreparationState | undefined;
  let preparationFailure: Error | undefined;

  /**
   * Prepare one isolated observer fixture, separately from product binaries. An
   * explicit binary is a prebuilt test observer, never the SDK helper. Its
   * digest records bytes actually used; it alone does not prove provenance.
   *
   * @evidence contracts/common.md#principled-implementation Captures the standalone module before/copy/after, builds its copied inputs with readonly module selection and checks the executable digest before every session.
   * @evidence contracts/common.md#clear-and-simple-design A single process-owned preparation serves all rows; explicit prebuilt selection and default isolated build share the same session protocol.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Builds only the authored test fixture, with no SDK source or binary mutation; prebuilt digest observations are not claimed as compilation provenance.
   * @evidence contracts/common.md#meaningful-documentation States the separate test-binary identity and distinguishes recorded bytes from provenance certification.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths and the host executable suffix select the observer; GOWORK off prevents importing the product workspace into the standalone module.
   * @evidence contracts/performance.md#efficient-algorithms One source scan and snapshot build prepare the fixture; reuse rechecks source and binary bytes without another build.
   * @evidence contracts/performance.md#reuse-equivalent-work Reuse requires identical source digest and explicit binary selection; changed inputs fail admission rather than silently sharing stale results.
   * @evidence contracts/performance.md#bound-retention-and-release-resources A tracked allocation owns copied source, isolated Go caches and executable until test exit. Native build failure conservatively retains its inputs because direct-child completion does not certify arbitrary tool descendants; a sticky terminal failure prevents repeated allocations. A session whose observer cannot be joined also retains its allocation and disables reuse.
   */
  export function prepare(options: { binary?: string } = {}): Prepared {
    if (preparationFailure) throw preparationFailure;
    const source = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/test/fixtures/process-observer",
    );
    const reading = readSource(source);
    const selected =
      options.binary === undefined
        ? undefined
        : fs.realpathSync.native(options.binary);
    if (shared) {
      if (
        shared.retained ||
        shared.prepared.sourceDigest !== reading.digest ||
        shared.selected !== selected
      )
        throw new Error(
          "Observer preparation inputs changed or remain unresolved",
        );
      shared.verify();
      return shared.prepared;
    }
    const allocation = TestProject.tmpdir("ttsc-process-observer-");
    const snapshot = path.join(allocation, "source");
    fs.cpSync(source, snapshot, { recursive: true });
    if (
      readSource(snapshot).digest !== reading.digest ||
      readSource(source).digest !== reading.digest
    )
      throw new Error("Observer source moved during capture");
    const binary =
      selected ??
      path.join(
        allocation,
        process.platform === "win32" ? "observer.exe" : "observer",
      );
    const goos: Record<string, string> = {
      win32: "windows",
      linux: "linux",
      darwin: "darwin",
    };
    const goarch: Record<string, string> = { x64: "amd64", arm64: "arm64" };
    if (!goos[process.platform] || !goarch[process.arch])
      throw new Error("Unsupported observer host target");
    fs.mkdirSync(path.join(allocation, "go-temp"));
    let sha256: string;
    try {
      if (!selected)
        E2eProcessTrace.execFileSync(
          "go",
          ["build", "-mod=readonly", "-o", binary, "."],
          {
            cwd: snapshot,
            env: {
              ...process.env,
              GOWORK: "off",
              GOENV: "off",
              GO111MODULE: "on",
              GOOS: goos[process.platform],
              GOARCH: goarch[process.arch],
              GOFLAGS: "",
              GOEXPERIMENT: "",
              GOARM: "",
              GOAMD64: "v1",
              GOARM64: "v8.0",
              CGO_ENABLED: "0",
              GOTOOLCHAIN: "local",
              GOCACHE: path.join(allocation, "go-cache"),
              GOMODCACHE: path.join(allocation, "go-modules"),
              GOTMPDIR: path.join(allocation, "go-temp"),
            },
            stdio: "pipe",
          },
        );
      if (
        readSource(source).digest !== reading.digest ||
        readSource(snapshot).digest !== reading.digest
      )
        throw new Error("Observer source moved during preparation");
      sha256 = hash(fs.readFileSync(binary));
    } catch (cause) {
      if (selected) throw cause;
      preparationFailure = new Error(
        "Observer preparation failed; retained inputs: " + allocation,
        { cause },
      );
      try {
        TestProject.retainTemporaryDirectory(
          allocation,
          "Observer native build descendant retirement is unknown",
        );
      } catch (retentionFailure) {
        preparationFailure = new AggregateError(
          [cause, retentionFailure],
          "Observer preparation failed and input retention was refused: " + allocation,
          { cause },
        );
      }
      throw preparationFailure;
    }
    const prepared: Prepared = Object.freeze({
      binary,
      sha256,
      sourceDigest: reading.digest,
      async open() {
        state.verify();
        return openSession(binary, () => {
          state.retained = true;
          TestProject.retainTemporaryDirectory(
            allocation,
            "Observer process closure is unknown",
          );
        });
      },
    });
    const state: PreparationState = {
      prepared,
      selected,
      retained: false,
      verify() {
        if (
          state.retained ||
          hash(fs.readFileSync(binary)) !== sha256 ||
          readSource(source).digest !== reading.digest
        )
          throw new Error("Observer input identity is no longer valid");
      },
    };
    shared = state;
    console.error(
      "Process observer input: " +
        JSON.stringify({
          binary,
          sha256,
          sourceDigest: reading.digest,
          prebuilt: selected !== undefined,
        }),
    );
    return prepared;
  }
}

interface Prepared {
  /** Absolute test-only executable, distinct from the SDK helper. */
  readonly binary: string;

  /** SHA256 of the executable actually opened. */
  readonly sha256: string;

  /** Sorted relative source names and byte hashes captured before the build. */
  readonly sourceDigest: string;

  /** Start an independent native session and await its readiness receipt. */
  open(): Promise<Session>;
}

interface PreparationState {
  /** Immutable metadata and session opener shared with consumers. */
  readonly prepared: Prepared;

  /** Exact explicit binary selection used for reuse admission. */
  readonly selected: string | undefined;

  /** Private sticky refusal; consumers cannot reset unresolved ownership. */
  retained: boolean;

  /** Check captured bytes and ownership before every subsequent session. */
  verify(): void;
}

interface Target {
  /** Session that retains this original kernel object. */
  readonly sessionNonce: string;

  /** Opaque acquisition request identity, never a numeric PID lookup key. */
  readonly targetId: string;

  /** Actual live enrollment PID, kept only for command/publication equality. */
  readonly pid: number;

  /** Supplemental platform/kernel/creation observations from enrollment. */
  readonly identity: Readonly<Record<string, unknown>>;
}

interface Session {
  /** Fresh protocol nonce shared by this session's authored rendezvous files. */
  readonly sessionNonce: string;

  /** Enroll a target while its authored gate holds its original lifetime live. */
  acquire(pid: number): Promise<Target>;

  /** Poll the original kernel object once, with zero additional grace time. */
  retired(target: Target): Promise<boolean>;

  /** Release all registrations and await the observer's actual process close. */
  close(): Promise<void>;
}

function hash(bytes: Buffer | string): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readSource(root: string): { digest: string } {
  const entries: string[] = [];
  const visit = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      const stat = fs.lstatSync(absolute);
      if (stat.isSymbolicLink())
        throw new Error("Observer source cannot contain symlinks");
      if (stat.isDirectory()) visit(absolute);
      else if (stat.isFile())
        entries.push(
          path.relative(root, absolute).split(path.sep).join("/") +
            ":" +
            hash(fs.readFileSync(absolute)),
        );
      else throw new Error("Unsupported observer source entry");
    }
  };
  visit(root);
  return { digest: hash(entries.join("\n")) };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function object(value: unknown): Record<string, unknown> {
  if (!isObject(value)) throw new Error("Observer frame must be an object");
  return value;
}

async function openSession(
  binary: string,
  retain: () => void,
): Promise<Session> {
  const sessionNonce = crypto.randomUUID();
  const child = E2eProcessTrace.spawn(
    binary,
    ["--session-nonce", sessionNonce],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const pending = new Map<
    string,
    {
      resolve: (frame: Record<string, unknown>) => void;
      reject: (error: unknown) => void;
      timer: NodeJS.Timeout;
    }
  >();
  const targets = new Set<Target>();
  let failure: Error | undefined;
  let closing: Promise<void> | undefined;
  let buffer = "";
  let stderr = "";
  let readyResolve!: () => void;
  let readyReject!: (error: unknown) => void;
  let readyReceived = false;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const fail = (cause: unknown): void => {
    failure ??= cause instanceof Error ? cause : new Error(String(cause));
    readyReject(failure);
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(failure);
    }
    pending.clear();
  };
  const exited = new Promise<void>((resolve) =>
    child.once("close", (code, signal) => {
      if (!closing || code !== 0 || signal !== null || buffer.length)
        fail(
          new Error(
            "Observer exited without certified close: " +
              JSON.stringify({ code, signal, stderr, buffer }),
          ),
        );
      resolve();
    }),
  );
  child.once("error", fail);
  child.stdin.on("error", fail);
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    if (failure) return;
    const overflow = stderr.length + chunk.length > 65536;
    stderr += chunk.slice(0, 65536 - stderr.length);
    if (overflow) fail(new Error("Observer diagnostics exceed protocol bound"));
  });
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
    if (failure) return;
    try {
      const overflow = buffer.length + chunk.length > 65536;
      buffer += chunk.slice(0, 65536 - buffer.length);
      if (overflow) throw new Error("Observer frame exceeds protocol bound");
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        const frame = object(JSON.parse(line));
        if (frame.version !== 1 || frame.sessionNonce !== sessionNonce)
          throw new Error("Foreign observer frame");
        if (frame.event === "ready") {
          if (readyReceived) throw new Error("Duplicate observer readiness");
          readyReceived = true;
          readyResolve();
          continue;
        }
        if (typeof frame.id !== "string")
          throw new Error("Observer response lacks request identity");
        const request = pending.get(frame.id);
        if (!request) throw new Error("Unsolicited observer response");
        pending.delete(frame.id);
        clearTimeout(request.timer);
        if (frame.event === "error") {
          const error = new Error(
            "Observer refused request: " + JSON.stringify(frame),
          );
          request.reject(error);
          fail(error);
        } else request.resolve(frame);
      }
    } catch (cause) {
      fail(cause);
    }
  });
  const readyTimer = setTimeout(
    () => fail(new Error("Observer readiness deadline")),
    5000,
  );
  const request = (
    op: string,
    values: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => {
    if (failure) return Promise.reject(failure);
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => fail(new Error("Observer request deadline: " + op)),
        5000,
      );
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(
        JSON.stringify({ version: 1, sessionNonce, id, op, ...values }) + "\n",
      );
    });
  };
  const close = (): Promise<void> =>
    (closing ??= (async () => {
      const timer = setTimeout(() => {
        try {
          retain();
        } catch (cause) {
          fail(cause);
        } finally {
          fail(
            new Error(
              "Observer graceful close deadline; original join remains required",
            ),
          );
          child.kill();
        }
      }, 5000);
      try {
        try {
          if (!failure) {
            const frame = await request("close");
            if (frame.event !== "closed")
              throw new Error("Observer did not acknowledge resource release");
          }
        } catch (cause) {
          fail(cause);
        }
        child.stdin.end();
        await exited;
      } finally {
        clearTimeout(timer);
      }
      targets.clear();
      if (failure) throw failure;
    })());
  try {
    await ready;
  } catch (cause) {
    await close().catch(() => {});
    throw cause;
  } finally {
    clearTimeout(readyTimer);
  }
  return {
    sessionNonce,
    async acquire(pid) {
      if (closing) throw new Error("Observer session is closed");
      if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error("Invalid enrollment PID");
      try {
        const frame = await request("acquire", { pid });
        const identity = object(frame.identity);
        const kernels: Record<string, string> = {
          win32: "windows-handle",
          linux: "pidfd",
          darwin: "kqueue-proc",
        };
        if (
          frame.event !== "acquired" ||
          frame.targetId !== frame.id ||
          frame.pid !== pid ||
          identity.platform !== process.platform ||
          identity.kernel !== kernels[process.platform] ||
          (process.platform === "win32" &&
            (typeof identity.creation !== "string" ||
              !/^[0-9]+$/.test(identity.creation)))
        )
          throw new Error("Observer acquisition identity mismatch");
        const target = Object.freeze({
          sessionNonce,
          targetId: String(frame.targetId),
          pid,
          identity: Object.freeze(identity),
        });
        targets.add(target);
        return target;
      } catch (cause) {
        fail(cause);
        throw cause;
      }
    },
    async retired(target) {
      if (closing || !targets.has(target))
        throw new Error("Target does not belong to this live observer session");
      try {
        const frame = await request("wait", {
          targetId: target.targetId,
          timeoutMs: 0,
        });
        if (
          frame.event !== "waited" ||
          frame.targetId !== target.targetId ||
          typeof frame.retired !== "boolean"
        )
          throw new Error("Observer retirement identity mismatch");
        return frame.retired;
      } catch (cause) {
        fail(cause);
        throw cause;
      }
    },
    close,
  };
}
