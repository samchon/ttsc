import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourceNativeRetirement } from "../../../../packages/ttsc/src/internal/SourceNativeRetirement";

// The existing named release unit owns these assertions and this fresh writer.
// Authored no-process classifications exercise cleanup policy, not native proof.
const root = process.argv[2]!;
const trace = process.env.TTSC_E2E_TRACE!;
assert.equal(path.isAbsolute(root), true);
assert.equal(fs.realpathSync.native(trace), fs.realpathSync.native(path.join(root, "trace")));
const failures: { name: string; error: string }[] = [];
const executed: string[] = [];
type Row = { event: string; data?: Record<string, unknown> };
const rows = (): Row[] => fs.readdirSync(trace)
  .filter(name => name.endsWith(".jsonl"))
  .flatMap(name => fs.readFileSync(path.join(trace, name), "utf8")
    .split("\n").filter(Boolean).map(line => JSON.parse(line) as Row));
const events = (task: string): Record<string, unknown>[] => rows()
  .filter(row => row.event === "capability-resolution" && row.data?.taskToken === task)
  .map(row => row.data!);
const check = (name: string, run: () => void): void => {
  executed.push(name);
  try { run(); } catch (error) {
    let detail: string;
    try { detail = String(error); } catch { detail = "Unprintable thrown value"; }
    failures.push({ name, error: detail });
  }
};
const scopeFor = (name: string) => {
  const directory = path.join(root, name);
  fs.mkdirSync(directory);
  const scope = SourceNativeRetirement.createScope(name);
  SourceNativeRetirement.run(scope, () => SourceNativeRetirement.register({
    fenceRoot: directory, retainedPaths: [directory],
  }));
  return { directory, scope };
};
const remove = (directory: string): void => fs.rmSync(directory, { recursive: true });

check("successful scoped cleanup", () => {
  const { directory, scope } = scopeFor("trace-success");
  SourceNativeRetirement.run(scope, () => SourceNativeRetirement.releaseResource(directory, () => remove(directory)));
  assert.equal(fs.existsSync(directory), false);
  assert.equal(scope.resources.size, 0);
  assert.deepEqual(events(scope.taskToken).map(event => event.phase), [
    "source-resource-cleanup-started", "source-resource-cleanup-returned",
  ]);
  assert.ok(events(scope.taskToken).every(event => event.resourceRoot === directory));
});

check("original filesystem failure and prior task failure", () => {
  const { directory, scope } = scopeFor("trace-error");
  const refused = Object.assign(new Error("secret diagnostic text"), {
    code: "EPERM", errno: 1, syscall: "rm", path: directory, dest: `${directory}-dest`,
  });
  const prior = new Error("original task failure");
  SourceNativeRetirement.run(scope, () => {
    assert.throws(() => SourceNativeRetirement.releaseResource(directory, () => { throw refused; }, { error: prior }), error => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0], prior);
      assert.equal(error.errors[1], refused);
      return true;
    });
  });
  assert.equal(scope.resources.size, 1);
  assert.equal(fs.existsSync(directory), true);
  const failed = events(scope.taskToken).find(event => event.phase === "source-resource-cleanup-threw");
  assert.ok(failed);
  assert.equal(failed.code, "EPERM");
  assert.equal(failed.errno, 1);
  assert.equal(failed.syscall, "rm");
  assert.equal(failed.path, directory);
  assert.equal(failed.dest, `${directory}-dest`);
  assert.equal(JSON.stringify(failed).includes("secret diagnostic text"), false);
  SourceNativeRetirement.run(scope, () => SourceNativeRetirement.releaseResource(directory, () => remove(directory)));
});

check("getter and reflection refusal preserve original thrown value", () => {
  for (const reflectThrows of [false, true]) {
    const { directory, scope } = scopeFor(`trace-reflection-${reflectThrows}`);
    let reads = 0;
    const target = Object.defineProperty(new Error("getter must remain unread"), "code", {
      get() { ++reads; throw new Error("unexpected getter execution"); },
    });
    const refused = reflectThrows ? new Proxy(target, {
      getOwnPropertyDescriptor() { throw new Error("authored reflection refusal"); },
    }) : target;
    SourceNativeRetirement.run(scope, () => {
      assert.throws(() => SourceNativeRetirement.releaseResource(directory, () => { throw refused; }), error => error === refused);
    });
    assert.equal(reads, 0);
    assert.equal(scope.resources.size, 1);
    assert.equal(fs.existsSync(directory), true);
    if (!reflectThrows) {
      const failed = events(scope.taskToken).find(event => event.phase === "source-resource-cleanup-threw");
      assert.ok(failed);
      assert.equal(Object.hasOwn(failed, "code"), false);
    }
    SourceNativeRetirement.run(scope, () => SourceNativeRetirement.releaseResource(directory, () => remove(directory)));
  }
});

check("thrown undefined remains an actual failure", () => {
  const { directory, scope } = scopeFor("trace-undefined");
  let caught = false;
  SourceNativeRetirement.run(scope, () => {
    try { SourceNativeRetirement.releaseResource(directory, () => { throw undefined; }); }
    catch (error) { caught = true; assert.equal(error, undefined); }
  });
  assert.equal(caught, true);
  assert.equal(scope.resources.size, 1);
  assert.ok(events(scope.taskToken).some(event => event.phase === "source-resource-cleanup-threw"));
  SourceNativeRetirement.run(scope, () => SourceNativeRetirement.releaseResource(directory, () => remove(directory)));
});

check("unknown deferral records only actual qualified execution", () => {
  const { directory, scope } = scopeFor("trace-deferred");
  const boundary = "authored-no-process-boundary";
  let attempts = 0;
  SourceNativeRetirement.run(scope, () => {
    SourceNativeRetirement.begin(boundary);
    SourceNativeRetirement.settle(boundary, "unknown", "authored unresolved classification");
    SourceNativeRetirement.releaseResource(directory, () => { ++attempts; remove(directory); });
  });
  assert.equal(attempts, 0);
  assert.deepEqual(events(scope.taskToken), []);
  assert.equal(scope.resources.size, 1);
  SourceNativeRetirement.recover(scope, boundary, "not-started");
  assert.equal(attempts, 1);
  assert.equal(scope.resources.size, 0);
  assert.deepEqual(events(scope.taskToken).map(event => event.phase), [
    "source-resource-cleanup-started", "source-resource-cleanup-boundary", "source-resource-cleanup-returned",
  ]);
  const observed = events(scope.taskToken)[1]!;
  assert.equal(observed.boundary, boundary);
  assert.equal(observed.retirement, "not-started");
});

check("disabled tracing performs no writer append", () => {
  const before = rows();
  delete process.env.TTSC_E2E_TRACE;
  try {
    const { directory, scope } = scopeFor("trace-disabled");
    const refused = new Error("disabled tracing original refusal");
    SourceNativeRetirement.run(scope, () => {
      assert.throws(() => SourceNativeRetirement.releaseResource(directory, () => { throw refused; }), error => error === refused);
      SourceNativeRetirement.releaseResource(directory, () => remove(directory));
    });
    assert.equal(scope.resources.size, 0);
  } finally { process.env.TTSC_E2E_TRACE = trace; }
  assert.deepEqual(rows(), before);
});

check("actual trace sink refusal cannot replace cleanup", () => {
  const filename = fs.readdirSync(trace).find(name => name.endsWith(".jsonl"));
  assert.ok(filename);
  const file = path.join(trace, filename);
  fs.unlinkSync(file);
  fs.mkdirSync(file);
  const { directory, scope } = scopeFor("trace-sink-refusal");
  const refused = new Error("original cleanup refusal despite sink failure");
  SourceNativeRetirement.run(scope, () => {
    assert.throws(() => SourceNativeRetirement.releaseResource(directory, () => { throw refused; }), error => error === refused);
    assert.equal(scope.resources.size, 1);
    SourceNativeRetirement.releaseResource(directory, () => remove(directory));
  });
  assert.equal(scope.resources.size, 0);
  assert.equal(fs.existsSync(directory), false);
});

console.log(JSON.stringify({ executed, failures }));
if (failures.length) process.exitCode = 1;
