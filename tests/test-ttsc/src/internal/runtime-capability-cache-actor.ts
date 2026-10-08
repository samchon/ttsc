import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { javascriptRuntimeCapabilities } from "../../../../packages/ttsc/src/internal/javascriptRuntimeCapabilities";
import { runtimeExecutableIdentity } from "../../../../packages/ttsc/src/internal/runtimeExecutableIdentity";

// One actual source actor owns trace admission and the otherwise module-local
// capability cache. Its owning named unit documents these script assertions.
const root = process.argv[2]!;
const trace = process.env.TTSC_E2E_TRACE!;
const failures: { name: string; error: string }[] = [];
const observations: Record<string, unknown>[] = [];
type Row = {
  event: string;
  pid: number | null;
  writerPid: number;
  data: {
    phase?: string;
    origin?: string;
    status?: number | null;
    signal?: string | null;
    started?: boolean;
    error?: { code?: string } | null;
    physical?: string;
  };
};
const readRows = (): Row[] =>
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
const observe = (name: string, operation: () => void): void => {
  try {
    operation();
  } catch (error) {
    failures.push({ name, error: String(error) });
  }
};
const clean: NodeJS.ProcessEnv = { NODE_OPTIONS: undefined };
const successful = {
  bun: false,
  executable: path.resolve(process.execPath),
  registerHooks: true,
};
const unsupported = { bun: false, registerHooks: false };

function probe(
  name: string,
  runtime: string,
  env: NodeJS.ProcessEnv,
  expected: typeof successful | typeof unsupported,
  proofs: number,
  resultsExpected: number,
  outcome: "success" | "nonzero" | "spawn-error" = "success",
  cwd = root,
): void {
  observe(name, () => {
    const before = readRows().length;
    const actual = javascriptRuntimeCapabilities(runtime, env, cwd);
    const rows = readRows().slice(before);
    const identities = rows.filter(
      (row) => row.data.phase === "runtime-executable-identity-observed",
    );
    const opened = rows.filter(
      (row) => row.data.phase === "runtime-executable-identity-opened",
    );
    const closed = rows.filter(
      (row) => row.data.phase === "runtime-executable-identity-closed",
    );
    const results = rows.filter(
      (row) =>
        row.event === "process-result" &&
        row.data.origin === "runtime-capability-probe",
    );
    observations.push({
      name,
      actual,
      proofs: identities.length,
      opened: opened.length,
      closed: closed.length,
      results: results.map((row) => ({ pid: row.pid, ...row.data })),
      bytes: identities.reduce(
        (sum, row) => sum + Number(row.data.physical!.split("\0")[3]),
        0,
      ),
    });
    observe(`${name}: capabilities`, () => assert.deepEqual(actual, expected));
    observe(`${name}: proof count`, () => assert.equal(identities.length, proofs));
    observe(`${name}: opened proof count`, () =>
      assert.equal(opened.length, proofs),
    );
    observe(`${name}: closed proof count`, () =>
      assert.equal(closed.length, proofs),
    );
    observe(`${name}: native result count`, () =>
      assert.equal(results.length, resultsExpected),
    );
    observe(`${name}: trace integrity`, () =>
      assert.ok(rows.every((row) => row.event !== "integrity-failure")),
    );
    for (const result of results) {
      observe(`${name}: native result`, () => {
        assert.equal(result.writerPid, process.pid);
        if (outcome === "spawn-error") {
          assert.equal(result.data.started, false);
          assert.equal(result.pid, null);
          assert.equal(result.data.status, null);
          assert.equal(result.data.signal, null);
          assert.equal(result.data.error?.code, "ENOENT");
        } else {
          assert.ok(result.pid !== null && result.pid > 0);
          assert.equal(result.data.started, true);
          assert.equal(result.data.signal, null);
          assert.equal(result.data.error, null);
          if (outcome === "success") assert.equal(result.data.status, 0);
          else
            assert.ok(
              typeof result.data.status === "number" && result.data.status !== 0,
            );
        }
      });
    }
  });
}

// Cache eligibility is established before any alias or relative row can warm it.
probe(
  "eligible empty miss", process.execPath, { NODE_OPTIONS: "" }, successful, 2, 1,
);
probe(
  "eligible whitespace hit", process.execPath, { NODE_OPTIONS: "  " }, successful, 1, 0,
);
for (let repeat = 0; repeat < 2; repeat++)
  probe(
    `nonblank fresh ${repeat}`, process.execPath,
    { NODE_OPTIONS: "--no-warnings" }, successful, 0, 1,
  );
for (const alias of ["node_options", "Node_Options"])
  probe(
    `native selector ${alias}`, process.execPath,
    process.platform === "win32"
      ? { [alias]: "--no-warnings" }
      : { ...clean, [alias]: "--no-warnings" },
    successful,
    process.platform === "win32" ? 0 : 1,
    process.platform === "win32" ? 1 : 0,
  );

// PATH and cwd select the real interpreter without copying its executable.
const runtimeDirectory = path.dirname(process.execPath);
const bare = path.basename(process.execPath);
const selectedPath = `${runtimeDirectory}${path.delimiter}${SidecarEnvironment.read(process.env, "PATH") ?? ""}`;
for (let repeat = 0; repeat < 2; repeat++) {
  probe(
    `bare fresh ${repeat}`, bare, { ...clean, PATH: selectedPath }, successful, 0, 1,
  );
  probe(
    `relative fresh ${repeat}`, `.${path.sep}${bare}`, clean,
    successful, 0, 1, "success", runtimeDirectory,
  );
}
probe(
  "nonzero probe", process.execPath, { NODE_OPTIONS: "--ttsc-invalid-option" },
  unsupported, 0, 1, "nonzero",
);
probe(
  "nonzero recovery", process.execPath, { NODE_OPTIONS: "--no-warnings" },
  successful, 0, 1,
);
const malformed = path.join(root, "malformed.cjs");
observe("malformed output preparation and probe", () => {
  fs.writeFileSync(malformed, 'process.stdout.write("not-json");\n');
  probe(
    "malformed output", process.execPath,
    { NODE_OPTIONS: `--require ${JSON.stringify(malformed)}` }, unsupported, 0, 1,
  );
});
probe(
  "malformed recovery", process.execPath, { NODE_OPTIONS: "--no-warnings" },
  successful, 0, 1,
);
probe(
  "eligible cache survives ineligible calls", process.execPath, clean,
  successful, 1, 0,
);

observe("native directory link retarget", () => {
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  fs.writeFileSync(path.join(first, "candidate"), "abc");
  fs.writeFileSync(path.join(second, "candidate"), "abd");
  const stamp = new Date(1_700_000_000_000);
  fs.utimesSync(path.join(first, "candidate"), stamp, stamp);
  fs.utimesSync(path.join(second, "candidate"), stamp, stamp);
  const link = path.join(root, "selected");
  const type = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(first, link, type);
  const selected = path.join(link, "candidate");
  const before = runtimeExecutableIdentity(selected);
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(
    fs.realpathSync.native(selected),
    fs.realpathSync.native(path.join(first, "candidate")),
  );
  fs.unlinkSync(link);
  fs.symlinkSync(second, link, type);
  const after = runtimeExecutableIdentity(selected);
  assert.ok(fs.lstatSync(link).isSymbolicLink());
  assert.equal(
    fs.realpathSync.native(selected),
    fs.realpathSync.native(path.join(second, "candidate")),
  );
  assert.equal(
    fs.statSync(path.join(first, "candidate")).size,
    fs.statSync(selected).size,
  );
  assert.equal(
    fs.statSync(path.join(first, "candidate")).mtimeMs,
    fs.statSync(selected).mtimeMs,
  );
  assert.ok(before);
  assert.ok(after);
  assert.notEqual(after, before);
  assert.ok(
    before.startsWith(`${fs.realpathSync.native(path.join(first, "candidate"))}\0`),
  );
  assert.ok(after.startsWith(`${fs.realpathSync.native(selected)}\0`));
  assert.ok(after.includes(createHash("sha256").update("abd").digest("hex")));
  observations.push({ name: "native directory link retarget", type, before, after });
});

probe(
  "failed spawn", process.execPath, { NODE_OPTIONS: "--no-warnings" },
  unsupported, 0, 1, "spawn-error", path.join(root, "absent-cwd"),
);
probe(
  "spawn recovery", process.execPath, { NODE_OPTIONS: "--no-warnings" },
  successful, 0, 1,
);
probe("eligible hit after spawn failure", process.execPath, clean, successful, 1, 0);
process.stdout.write(
  JSON.stringify({ pid: process.pid, runtime: process.version, observations, failures }) + "\n",
);
if (failures.length !== 0) process.exitCode = 1;
