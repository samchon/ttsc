import { assertRuntimeCleanupEligibility, TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies native cwd identity without losing authenticated cleanup evidence.
 *
 * Requested cwd and process cwd may use different directory aliases. The
 * actual shared scan assertion must accept that identity, preserve one raw
 * spelling per invocation, and distinguish deletion from protected ownership.
 *
 * 1. Create real directory aliases and accept both directions for complete absence and protection.
 * 2. Refuse foreign, missing, broken and mixed cwd evidence and malformed invocation frames.
 * 3. Contrast raw local ESRCH with present, remote, uncertain and invalid owner records.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual public test-only scan assertion with real filesystem aliases and authored raw observation frames; its result or refusal is observed directly.
 * @evidence contracts/testing.md#independent-expectations Independently created aliases name one directory, another directory is foreign, complete local ESRCH requires removal, and present/remote/unknown ownership requires protection. No selected cleanup answer generates an expectation.
 * @evidence contracts/testing.md#distinguishing-cases Both alias directions cover deletion and protection. Missing/broken/foreign/mixed cwd, malformed writer/sequence/invocation/argv/generation/cache and raw owner policy contrasts reject evidence that cannot certify this scan.
 * @evidence contracts/testing.md#execution-ownership The normal test-ttsc unit runner discovers this export. It imports the shared testing operation rather than another suite's internals, creates only directory-shaped decision inputs, and starts no compiler, native producer, installer or process host. Fixture cleanup runs after the entire case population, including failures.
 */
export function test_runtime_cleanup_assertion_preserves_physical_cwd_identity(): void {
  const root = TestProject.tmpdir("ttsc-cleanup-cwd-");
  const failures: unknown[] = [];
  const check = (name: string, body: () => void): void => {
    try { body(); }
    catch (cause) { failures.push(new Error(name, { cause })); }
  };
  try {
    const physical = path.join(root, "physical");
    const alias = path.join(root, "alias");
    const foreign = path.join(root, "foreign");
    const broken = path.join(root, "broken");
    fs.mkdirSync(physical);
    fs.mkdirSync(foreign);
    // Node ignores this directory-link type on POSIX and creates a junction
    // on Windows; actual realpath below, rather than OS name, proves identity.
    fs.symlinkSync(physical, alias, "junction");
    fs.symlinkSync(path.join(root, "absent"), broken, "junction");
    assert.notEqual(alias, physical);
    assert.equal(fs.realpathSync.native(alias), fs.realpathSync.native(physical));
    const launcher = 17;
    const owner = 23;
    const hostname = os.hostname();
    const record = (pid: number, result: string, errorCode?: string) => ({
      record: `owner-${pid}.json`, owner: { hostname, pid }, result,
      ...(errorCode === undefined ? {} : { errorCode }),
    });
    const fixture = (
      observations: Record<string, any>[] = [record(owner, "absent", "ESRCH")],
      ownership: "abandoned" | "live" | "unknown" = "abandoned",
      ownerNames?: string[],
    ) => {
      const expected = {
        launcher, owner, hostname, directory: path.join(root, "generation"),
        cache: path.join(root, "cache"), argv: ["authored-ttsx", "entry.ts"],
        cwd: physical, ownerNames,
      };
      const phases = [
        { phase: "attempt" }, { phase: "lock-entered" },
        ...observations.map(ownerObservation => ({ phase: "owner-observation", ownerObservation })),
        { phase: "ownership", ownership },
        { phase: ownership === "abandoned" ? "removed" : "retained", ownership },
        { phase: "completed" },
      ];
      const rows: Record<string, any>[] = phases.map((data, index) => ({
        schema: 1, event: "runtime-cleanup", writerPid: launcher, pid: launcher,
        instance: "authored-instance", invocation: "authored-instance:7",
        sequence: index + 10, argv: expected.argv, cwd: physical,
        data: { ...data, origin: "ttsx-runtime-cleanup", directory: expected.directory, runtimeCacheDir: expected.cache },
      }));
      return { rows, expected };
    };
    for (const protectedRun of [false, true]) {
      for (const [requested, observed] of [[alias, physical], [physical, alias]])
        check(`native alias requested=${requested} observed=${observed} protected=${protectedRun}`, () => {
          const f = fixture([record(owner, protectedRun ? "present" : "absent", protectedRun ? undefined : "ESRCH")],
            protectedRun ? "live" : "abandoned", protectedRun ? [`owner-${owner}.json`] : undefined);
          f.expected.cwd = requested!;
          for (const row of f.rows) row.cwd = observed;
          assert.equal(assertRuntimeCleanupEligibility(f.rows, f.expected), protectedRun);
        });
    }
    const refusal = (name: string, mutate: (f: ReturnType<typeof fixture>) => void): void => check(name, () => {
      const f = fixture(); mutate(f);
      assert.throws(() => assertRuntimeCleanupEligibility(f.rows, f.expected));
    });
    for (const [name, value] of [["foreign", foreign], ["missing", path.join(root, "missing")], ["broken", broken], ["relative", "."], ["empty", ""]]) {
      refusal(`refuse ${name} observed cwd`, f => { for (const row of f.rows) row.cwd = value; });
      refusal(`refuse ${name} requested cwd`, f => { f.expected.cwd = value!; });
    }
    refusal("missing raw cwd", f => { delete f.rows[0]!.cwd; });
    refusal("mixed raw spellings for the same directory", f => { f.rows[0]!.cwd = alias; });
    for (const [name, mutate] of [
      ["schema", (f: ReturnType<typeof fixture>) => { f.rows[2]!.schema = 2; }],
      ["event", (f: ReturnType<typeof fixture>) => { f.rows[2]!.event = "process-result"; }],
      ["instance", (f: ReturnType<typeof fixture>) => { f.rows[2]!.instance = "foreign"; }],
      ["origin", (f: ReturnType<typeof fixture>) => { f.rows[2]!.data.origin = "runtime-clean-selection"; }],
      ["scan error", (f: ReturnType<typeof fixture>) => { f.rows[2]!.data.errorCode = "EIO"; }],
      ["writer", (f: ReturnType<typeof fixture>) => { f.rows[0]!.writerPid = owner; }],
      ["pid", (f: ReturnType<typeof fixture>) => { f.rows[0]!.pid = owner; }],
      ["sequence gap", (f: ReturnType<typeof fixture>) => { f.rows[2]!.sequence++; }],
      ["invocation", (f: ReturnType<typeof fixture>) => { f.rows[2]!.invocation = "authored-instance:8"; }],
      ["argv", (f: ReturnType<typeof fixture>) => { f.rows[2]!.argv = ["foreign"]; }],
      ["generation", (f: ReturnType<typeof fixture>) => { f.rows[2]!.data.directory = foreign; }],
      ["cache", (f: ReturnType<typeof fixture>) => { f.rows[2]!.data.runtimeCacheDir = foreign; }],
      ["incomplete", (f: ReturnType<typeof fixture>) => { f.rows.pop(); }],
      ["wrong selected answer", (f: ReturnType<typeof fixture>) => { f.rows.at(-2)!.data.phase = "retained"; }],
    ] as const) refusal(`refuse ${name}`, mutate);
    check("complete local ESRCH includes the independently admitted main", () => {
      const f = fixture([record(29, "absent", "ESRCH"), record(owner, "absent", "ESRCH")]);
      assert.equal(assertRuntimeCleanupEligibility(f.rows, f.expected), false);
    });
    for (const [name, observation, ownership] of [
      ["present", record(owner, "present"), "live"],
      ["uncertain local", record(owner, "unknown", "EACCES"), "live"],
      ["remote", { ...record(owner, "remote"), owner: { hostname: hostname + ".foreign", pid: owner } }, "live"],
      ["invalid owner", { record: `owner-${owner}.json`, result: "invalid-record" }, "unknown"],
    ] as const) check(`protect ${name}`, () => {
      const f = fixture([observation], ownership, [`owner-${owner}.json`]);
      assert.equal(assertRuntimeCleanupEligibility(f.rows, f.expected), true);
    });
    check("uncertain record remains protected after complete absent-owner probes", () => {
      const f = fixture([{ record: "owner-invalid.json", result: "invalid-record" }, record(owner, "absent", "ESRCH")], "unknown", ["owner-invalid.json", `owner-${owner}.json`]);
      assert.equal(assertRuntimeCleanupEligibility(f.rows, f.expected), true);
    });
    check("valid short circuit retains the independently recorded main owner", () => {
      const f = fixture([record(29, "present")], "live", ["owner-29.json", `owner-${owner}.json`]);
      assert.equal(assertRuntimeCleanupEligibility(f.rows, f.expected), true);
    });
    for (const [name, observations] of [
      ["main coverage absent", [record(29, "absent", "ESRCH")]],
      ["launcher claim remains", [record(launcher, "absent", "ESRCH"), record(owner, "absent", "ESRCH")]],
      ["duplicate owner", [record(owner, "absent", "ESRCH"), record(owner, "absent", "ESRCH")]],
      ["foreign local hostname", [{ ...record(owner, "absent", "ESRCH"), owner: { pid: owner, hostname: hostname + ".foreign" } }]],
      ["record escapes directory", [{ ...record(owner, "absent", "ESRCH"), record: "../owner-23.json" }]],
      ["absence without ESRCH", [record(owner, "absent", "EACCES")]],
      ["unknown mislabeled ESRCH", [record(owner, "unknown", "ESRCH")]],
    ] as const) check(`refuse ${name}`, () => {
      const f = fixture([...observations]);
      assert.throws(() => assertRuntimeCleanupEligibility(f.rows, f.expected));
    });
    check("protection cannot omit the original main record", () => {
      const f = fixture([record(owner, "present")], "live", []);
      assert.throws(() => assertRuntimeCleanupEligibility(f.rows, f.expected));
    });
    check("observations cannot continue after a live short circuit", () => {
      const f = fixture([record(owner, "present"), record(29, "absent", "ESRCH")], "live", [`owner-${owner}.json`, "owner-29.json"]);
      assert.throws(() => assertRuntimeCleanupEligibility(f.rows, f.expected));
    });
  } finally {
    try {
      fs.rmSync(root, { recursive: true, force: true });
      assert.equal(fs.existsSync(root), false);
    } catch (cause) { failures.push(new Error("remove owned direct-unit directory", { cause })); }
  }
  if (failures.length) throw new AggregateError(failures, "Runtime cleanup identity and policy controls failed");
}