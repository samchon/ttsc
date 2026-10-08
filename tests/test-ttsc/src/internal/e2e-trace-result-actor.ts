import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../../packages/ttsc/src/internal/E2ETrace";

// The named unit owns these script assertions and this isolated trace lifetime.
const root = process.argv[2]!;
const trace = process.env.TTSC_E2E_TRACE!;
const failures: { name: string; error: string }[] = [];
const observations: Record<string, unknown>[] = [];
type Row = {
  event: string;
  invocation: string;
  writerPid: number;
  instance: string;
  pid: number | null;
  data: Record<string, unknown>;
};
type Payload =
  | { text: string; representation: "returned-string" }
  | { path: string; bytes: number };
const rows = (): Row[] =>
  fs
    .readdirSync(trace)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(trace, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Row),
    );
const check = (name: string, operation: () => void): void => {
  try {
    operation();
  } catch (error) {
    failures.push({ name, error: String(error) });
  }
};
const readPayload = (reference: unknown): Buffer | string | null => {
  if (reference === null) return null;
  assert.ok(reference && typeof reference === "object");
  const payload = reference as Payload;
  if ("representation" in payload) {
    assert.equal(payload.representation, "returned-string");
    return payload.text;
  }
  const bytes = fs.readFileSync(path.join(trace, payload.path));
  assert.equal(bytes.length, payload.bytes);
  return bytes;
};

function run(
  name: string,
  command: string,
  options: childProcess.SpawnSyncOptions,
  args = ["-e", 'process.stdout.write("out");process.stderr.write("err");'],
): void {
  let native: ReturnType<typeof childProcess.spawnSync> | undefined;
  const before = rows().length;
  const returned = E2ETrace.synchronous(command, args, options, name, () => {
    native = childProcess.spawnSync(command, args, options);
    return native;
  });
  const observed = rows().slice(before);
  observations.push({
    name,
    pid: returned.pid,
    status: returned.status,
    signal: returned.signal,
    error: returned.error?.message,
    stdoutType: typeof returned.stdout,
    stderrType: typeof returned.stderr,
    events: observed,
  });
  check(`${name}: native identity`, () => assert.equal(returned, native));
  check(`${name}: actual result`, () => {
    const result = observed.find((row) => row.event === "process-result")!;
    assert.ok(result);
    assert.equal(
      observed.filter((row) => row.event === "process-attempt").length,
      1,
    );
    assert.equal(
      observed.filter((row) => row.event === "process-result").length,
      1,
    );
    assert.equal(result.writerPid, process.pid);
    assert.equal(result.pid, returned.pid > 0 ? returned.pid : null);
    assert.equal(result.data.started, returned.pid > 0);
    assert.equal(result.data.status, returned.status);
    assert.equal(result.data.signal, returned.signal);
    assert.equal(
      result.data.exitObserved,
      returned.status !== null || returned.signal !== null,
    );
    assert.deepEqual(
      result.data.error,
      returned.error === undefined
        ? null
        : {
            name: returned.error.name,
            message: returned.error.message,
            code: (returned.error as NodeJS.ErrnoException).code,
            errno: (returned.error as NodeJS.ErrnoException).errno,
            syscall: (returned.error as NodeJS.ErrnoException).syscall,
          },
    );
    assert.deepEqual(readPayload(result.data.stdout), returned.stdout ?? null);
    assert.deepEqual(readPayload(result.data.stderr), returned.stderr ?? null);
    assert.ok(observed.every((row) => row.event !== "integrity-failure"));
  });
  check(`${name}: command outcome`, () => {
    if (name.startsWith("failed")) {
      assert.equal(returned.pid, 0);
      assert.equal(returned.status, null);
      assert.equal((returned.error as NodeJS.ErrnoException).code, "ENOENT");
    } else {
      assert.ok(returned.pid > 0);
      assert.equal(returned.error, undefined);
      assert.equal(returned.status, name === "nonzero" ? 7 : 0);
      if (name.startsWith("recovery")) {
        assert.deepEqual(
          returned.stdout,
          options.encoding === "utf8" ? "out" : Buffer.from("out"),
        );
        assert.deepEqual(
          returned.stderr,
          options.encoding === "utf8" ? "err" : Buffer.from("err"),
        );
      }
      if (name === "ignored-streams") {
        assert.equal(returned.stdout, null);
        assert.equal(returned.stderr, null);
      }
      if (name === "empty-buffer") {
        assert.deepEqual(returned.stdout, Buffer.alloc(0));
        assert.deepEqual(returned.stderr, Buffer.alloc(0));
      }
    }
  });
}

run("failed-cwd", process.execPath, {
  cwd: path.join(root, "absent-cwd"),
  encoding: "utf8",
});
run("recovery-text", process.execPath, { encoding: "utf8" });
run("failed-executable", path.join(root, "absent-runtime"), {
  encoding: "utf8",
});
run("recovery-buffer", process.execPath, {});
run("ignored-streams", process.execPath, { stdio: "ignore" });
run("empty-buffer", process.execPath, {}, ["-e", ""]);
run("nonzero", process.execPath, { encoding: "utf8" }, [
  "-e",
  "process.exitCode=7",
]);

// Force a genuine payload IO error without patching filesystem methods. The
// attempt's actual writer identity determines the next owned payload pathname.
const token = E2ETrace.begin(process.execPath, ["-e", ""], {}, "payload-io");
const attempt = rows().findLast((row) => row.event === "process-attempt");
let blocked: string | undefined;
if (token && attempt) {
  blocked = path.join(
    trace,
    `${process.pid}-${attempt.instance}-${token.invocation}-stdout.bin`,
  );
  fs.mkdirSync(blocked);
}
const native = childProcess.spawnSync(process.execPath, ["-e", ""]);
E2ETrace.result(token, native);
check("payload IO failure metadata", () => {
  assert.ok(token);
  assert.equal(native.status, 0);
  assert.equal(native.error, undefined);
  assert.equal(
    rows().findLast((row) => row.event === "integrity-failure")?.data.outcome,
    "payload-io-failed",
  );
});
if (blocked) fs.rmdirSync(blocked);
const before = rows();
const later = E2ETrace.synchronous(
  process.execPath,
  ["-e", ""],
  {},
  "after-io",
  () => childProcess.spawnSync(process.execPath, ["-e", ""]),
);
check("genuine IO failure stays closed", () => {
  assert.equal(later.status, 0);
  assert.equal(later.error, undefined);
  assert.deepEqual(rows(), before);
});
observations.push({
  name: "genuine payload IO failure",
  events: rows().slice(-3),
  laterStatus: later.status,
});
process.stdout.write(
  JSON.stringify({ pid: process.pid, observations, failures }) + "\n",
);
if (failures.length) process.exitCode = 1;
