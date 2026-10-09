import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readE2eTracePayload } from "../../readE2eTracePayload";

/**
 * Pins one completed canonical host's explicit runtime index to a sibling
 * physical directory. The caller owns root, has joined earlier hosts, and has
 * not begun using this explicit cache. No new project or launcher is created.
 * This setup does not itself prove runtime start, child admission or cleanup.
 *
 * @evidence contracts/common.md#principled-implementation A fresh owned physical directory and a native link establish a different generation parent before the real canonical host claims any run; independently empty initial contents prevent an old generation from supplying the later cleanup observation.
 * @evidence contracts/common.md#clear-and-simple-design Preparation returns only the physical directory needed by the parent after its configured host closes; the parent keeps launcher status and user-output assertions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem calls create the actual alias without replacing runtime lock, claim, compiler or loader operations. An absent link capability fails this case rather than predicting successful transport.
 * @evidence contracts/common.md#meaningful-documentation States caller root ownership, joined earlier readers, unused explicit cache and the setup's lack of runtime completion evidence.
 * @evidence contracts/portability.md#os-neutral-implementation Node creates a Windows junction or POSIX directory link; lstat and native realpath verify the actual representation and target instead of inferring identity from the OS name.
 * @evidence contracts/performance.md#efficient-algorithms Constant-count directory and identity operations prepare one existing canonical cache; no fixture traversal, compiler preparation or launcher starts here.
 * @evidence contracts/performance.md#reuse-equivalent-work The existing configured host consumes this one prepared index. Repeated preparation is refused because its cache admission state would no longer be equivalent.
 * @evidence contracts/performance.md#bound-retention-and-release-resources No handles or processes remain in this setup; the parent's tracked canonical root owns the physical directory and alias through host completion, failure and test-process cleanup.
 */
export function prepareCanonicalLinkedRuntimeIndex(root: string): string {
  const cache = path.join(root, ".ttsx-cache");
  const physicalRuns = path.join(root, "physical-runs");
  const link = path.join(cache, "project");
  assert.equal(
    fs.existsSync(link),
    false,
    "linked index must precede first cache admission",
  );
  assert.equal(
    fs.existsSync(physicalRuns),
    false,
    "physical run index must be an owned fresh name",
  );
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(physicalRuns);
  fs.symlinkSync(
    physicalRuns,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(fs.lstatSync(link).isSymbolicLink(), true);
  assert.equal(
    fs.realpathSync.native(link),
    fs.realpathSync.native(physicalRuns),
  );
  assert.deepEqual(fs.readdirSync(physicalRuns), []);
  return physicalRuns;
}

/**
 * Read the actual writer snapshot after the caller has joined its selected work.
 * A still-live parent may append later; no selected invocation is synthesized.
 *
 * @evidence contracts/common.md#principled-implementation Native file identity, complete JSONL frames, writer PID/nonce and increasing sequence bind the snapshot without a PID liveness probe.
 * @evidence contracts/common.md#clear-and-simple-design One reader serves the active entry and retained donor; callers own the actual selected invocation and process joins.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or unstable writer bytes and integrity failures reject the observation instead of supplying an expected row.
 * @evidence contracts/common.md#meaningful-documentation States after-join selection and the distinction between snapshot integrity and parent process completion.
 * @evidence contracts/portability.md#os-neutral-implementation Native metadata and exact writer filenames retain actual filesystem identity without case folding.
 * @evidence contracts/performance.md#efficient-algorithms Reads only the selected PID's writer files, with work proportional to their actual metadata bytes.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every call reads current selected writer bytes; an earlier snapshot cannot certify another invocation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads close their handles; retained trace root and writer joins remain caller-owned.
 */
export function readRuntimeTraceWriter(root: string, pid: number): Record<string, any>[] {
  assert.ok(path.isAbsolute(root));
  const records: Record<string, any>[] = [];
  for (const name of fs.readdirSync(root!)) {
    if (!name.startsWith(pid + "-") || !/^[0-9]+-[a-f0-9-]+\.jsonl$/.test(name)) continue;
    const file = path.join(root!, name);
    const before = fs.lstatSync(file, { bigint: true });
    assert.ok(before.isFile() && before.size <= BigInt(256 * 1024 * 1024));
    const text = fs.readFileSync(file, "utf8");
    const after = fs.lstatSync(file, { bigint: true });
    assert.ok(after.isFile());
    assert.deepEqual([after.dev, after.ino, after.size, after.mtimeNs, after.ctimeNs],
      [before.dev, before.ino, before.size, before.mtimeNs, before.ctimeNs]);
    assert.equal(Buffer.byteLength(text), Number(before.size));
    assert.ok(text.endsWith("\n"), "the selected writer snapshot must contain complete JSONL frames");
    let sequence = 0;
    for (const line of text.trimEnd().split(/\r?\n/)) {
      const row = JSON.parse(line);
      assert.equal(row.schema, 1);
      assert.equal(row.writerPid, pid);
      assert.equal(name, `${pid}-${row.instance}.jsonl`);
      assert.ok(Number.isSafeInteger(row.sequence) && row.sequence > sequence);
      sequence = row.sequence;
      assert.notEqual(row.event, "integrity-failure");
      records.push(row);
    }
  }
  return records;
}

/**
 * Checks one real completed CLI's normal cleanup from its raw owner probes.
 * The caller owns original launcher completion and a pre-call cache population.
 * Its actual child start and every selected-source preparation identify one new run.
 * Every capture must agree on statements, map and authored source; protection
 * additionally preserves the native emitted artifact for comparison.
 * Earlier generations may be swept on admission and never supply this run's proof.
 * Load hooks may prepare an entry more than once before its one evaluation.
 * Each captured source is checked; inline map encoding and physical source
 * coordinates may differ while statements and normalized map content agree.
 *
 * @evidence contracts/common.md#principled-implementation Actual launcher/program/source attribution and the same cleanup invocation bind one new generation before the shared raw-observation policy table determines deletion or protection.
 * @evidence contracts/common.md#clear-and-simple-design One operation joins writer reading, generation attribution and retained source proof for both callers; each caller keeps its own synchronous or asynchronous launcher completion authority.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No new process probe, deletion, producer, selected-answer expectation or synthetic native result supplies the assertion. Missing or foreign evidence fails.
 * @evidence contracts/common.md#meaningful-documentation Separates selected normal cleanup from earlier-generation admission sweeps and requires actual pre-call population rather than invented historical byte snapshots.
 * @evidence contracts/portability.md#os-neutral-implementation Native physical identities, hostname comparison and exact map source rebasing retain filesystem and ownership semantics without platform-name branches.
 * @evidence contracts/performance.md#efficient-algorithms Reads the selected launcher and program writers and each selected-source payload. Representation checks scale with their actual bytes; retained native JavaScript and map are read once for comparison with every preparation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Another host's output or cleanup scan cannot certify the current generation.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Reads close before return; caller-owned trace, runtime index, source inputs and original process lifetimes remain retained on uncertainty.
 */
export function verifyRuntimeCleanup(expected: {
  traceRoot: string; launcher: number; owner?: number; argv: string[]; cwd: string;
  cache: string; entry: string; source: Buffer; before: string[];
  synchronous?: { writer: number; before: string[] };
}): void {
  if (expected.synchronous) {
    const parent = readRuntimeTraceWriter(expected.traceRoot, expected.synchronous.writer);
    const results = parent.filter((row) => row.event === "process-result" && row.pid === expected.launcher &&
      !expected.synchronous!.before.includes(row.invocation));
    assert.equal(results.length, 1, "the original synchronous launcher must have one new result");
    const result = results[0]!;
    assert.deepEqual(result.argv, expected.argv);
    assert.equal(result.cwd, expected.cwd);
    assert.equal(result.started, true);
    assert.equal(result.exitObserved, true);
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.error, undefined);
    const attempts = parent.filter((row) => row.event === "process-attempt" &&
      row.instance === result.instance && row.invocation === result.invocation);
    assert.equal(attempts.length, 1);
    assert.deepEqual(attempts[0]!.argv, result.argv);
    assert.equal(attempts[0]!.cwd, result.cwd);
    assert.ok(attempts[0]!.sequence < result.sequence);
  }
  const rows = readRuntimeTraceWriter(expected.traceRoot, expected.launcher);
  const children = rows.filter((row) => row.event === "process-start" && row.data?.origin === "ttsx-runtime");
  assert.equal(children.length, 1, "the CLI must admit one actual main program");
  const child = children[0]!;
  const owner = child.pid;
  assert.ok(Number.isSafeInteger(owner) && owner > 0);
  if (expected.owner !== undefined) assert.equal(owner, expected.owner);
  const closed = rows.filter((row) => row.event === "process-close" &&
    row.instance === child.instance && row.invocation === child.invocation);
  assert.equal(closed.length, 1);
  assert.equal(closed[0]!.pid, owner);
  assert.equal(closed[0]!.data.status, 0);
  assert.equal(closed[0]!.data.signal, null);
  const entry = fs.realpathSync.native(expected.entry);
  const preparations = readRuntimeTraceWriter(expected.traceRoot, owner).filter((row) => {
    if (row.event !== "runtime-source-preparation") return false;
    return [row.data.filename, row.data.emitAttribution?.sourceFile]
      .filter((filename) => filename !== undefined)
      .some((filename) => {
        const resolved = path.resolve(filename);
        if (resolved === path.resolve(expected.entry) || resolved === entry) return true;
        try {
          return fs.realpathSync.native(resolved) === entry;
        } catch (error) {
          // An unrelated historical preparation need not retain its source file.
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
          throw error;
        }
      });
  });
  assert.ok(preparations.length > 0, "the original program must consume the selected source");
  const emittedFile = preparations[0]!.data.emitAttribution?.emittedFile;
  assert.equal(typeof emittedFile, "string");
  const project = fs.realpathSync.native(path.join(expected.cache, "project"));
  const relative = path.relative(project, emittedFile);
  assert.ok(relative && !path.isAbsolute(relative) && relative.split(path.sep)[0] !== "..");
  const directory = path.join(project, relative.split(path.sep)[0]!);
  assert.equal(expected.before.includes(path.basename(directory)), false, "this program must own a newly admitted run");
  const representations = preparations.map((prepared) => {
    assert.equal(prepared.pid, owner);
    assert.equal(fs.realpathSync.native(prepared.data.filename), entry);
    assert.equal(fs.realpathSync.native(prepared.argv[1]), entry);
    const entryArgument = child.argv.length - prepared.argv.length + 1;
    assert.ok(entryArgument > 0);
    assert.deepEqual(prepared.argv, [child.argv[0], ...child.argv.slice(entryArgument)]);
    assert.equal(fs.realpathSync.native(prepared.cwd), fs.realpathSync.native(child.cwd));
    assert.ok(["ttsx-esm-source-load", "ttsx-commonjs-source-load", "ttsx-commonjs-source-import"].includes(prepared.data.origin));
    assert.equal(prepared.data.selectedFormat, prepared.data.origin === "ttsx-esm-source-load" ? "module" : "commonjs");
    assert.equal(prepared.data.emitAttribution.emittedFile, emittedFile, "every preparation must name this run's same emitted source");
    assert.equal(fs.realpathSync.native(prepared.data.emitAttribution.sourceFile), entry);
    assert.deepEqual(prepared.data.emitAttribution.moduleOptions, preparations[0]!.data.emitAttribution.moduleOptions);
    assert.equal(prepared.data.sourceEncoding, "utf16le");
    assert.equal(prepared.data.representation, "consumed-javascript-string");
    assert.ok(Number.isSafeInteger(prepared.data.sourceCodeUnits) && prepared.data.sourceCodeUnits >= 0);
    const bytes = readE2eTracePayload(expected.traceRoot, prepared as {
      writerPid: number; instance: string; invocation: string;
    }, prepared.data.source).bytes;
    assert.equal(bytes.length, prepared.data.sourceCodeUnits * 2);
    const consumed = runtimeSourceRepresentation(bytes.toString("utf16le"), emittedFile, directory);
    const index = (consumed.map.sources as string[]).indexOf(entry);
    assert.notEqual(index, -1);
    assert.equal(consumed.map.sourcesContent[index], expected.source.toString("utf8"));
    return consumed;
  });
  for (const representation of representations)
    assert.deepEqual(representation, representations[0], "every preparation must preserve this immutable emit's statements and map");
  const cleanupRows = rows.filter((row) => row.event === "runtime-cleanup");
  assert.ok(cleanupRows.length > 0 && closed[0]!.sequence < cleanupRows[0]!.sequence);
  const cache = cleanupRows[0]!.data.runtimeCacheDir;
  assert.equal(fs.realpathSync.native(cache), fs.realpathSync.native(expected.cache));
  const ownerNames = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) =>
    name.startsWith("owner-") && name.endsWith(".json")) : undefined;
  if (ownerNames) {
    const ownerFile = path.join(directory, `owner-${owner}.json`);
    assert.ok(fs.lstatSync(ownerFile).isFile());
    assert.deepEqual(JSON.parse(fs.readFileSync(ownerFile, "utf8")), { hostname: os.hostname(), pid: owner });
  }
  const retained = assertRuntimeCleanupEligibility(cleanupRows, {
    ...expected, cache, owner, hostname: os.hostname(), directory, ownerNames,
  });
  const after = fs.readdirSync(project);
  assert.deepEqual(after.filter((name) => !expected.before.includes(name)), retained ? [path.basename(directory)] : []);
  if (retained) {
    const emitted = runtimeSourceRepresentation(fs.readFileSync(emittedFile, "utf8"), emittedFile, directory);
    for (const consumed of representations)
      assert.deepEqual(emitted, consumed, "protection preserves native statements and map apart from runtime coordinate rebasing");
  }
  assert.deepEqual(fs.readFileSync(expected.entry), expected.source);
}

/** Compare actual statements and map content, not the map comment's encoding. */
function runtimeSourceRepresentation(javascript: string, emittedFile: string, directory: string): {
  statements: string; map: Record<string, any>;
} {
  const reference = /\/\/[#@] sourceMappingURL=([^\r\n]*)[ \t\r\n]*$/.exec(javascript);
  assert.ok(reference, "the selected runtime source must carry its native map");
  const url = reference[1]!.trim();
  let json: string;
  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    assert.ok(comma > 0 && url.slice(0, comma).split(";")[0] === "data:application/json");
    const encoded = url.slice(comma + 1);
    if (url.slice(0, comma).split(";").includes("base64")) {
      assert.ok(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded));
      json = Buffer.from(encoded, "base64").toString("utf8");
    } else json = decodeURIComponent(encoded);
  } else {
    const mapFile = path.resolve(path.dirname(emittedFile), decodeURIComponent(url));
    const relativeMap = path.relative(directory, mapFile);
    assert.ok(relativeMap && !path.isAbsolute(relativeMap) && relativeMap.split(path.sep)[0] !== "..");
    assert.ok(fs.lstatSync(mapFile).isFile());
    json = fs.readFileSync(mapFile, "utf8");
  }
  const map = JSON.parse(json);
  assert.equal(map.version, 3);
  assert.ok(Array.isArray(map.sources) && Array.isArray(map.sourcesContent));
  const sourceRoot = typeof map.sourceRoot === "string" && map.sourceRoot.startsWith("file:")
    ? fileURLToPath(map.sourceRoot) : map.sourceRoot ?? "";
  map.sources = map.sources.map((file: string) => fs.realpathSync.native(
    file.startsWith("file:") ? fileURLToPath(file) : path.resolve(path.dirname(emittedFile), sourceRoot, file)));
  delete map.sourceRoot;
  return { statements: javascript.slice(0, reference.index), map };
}

/**
 * Validates one completed scan against raw probes, never its selected answer.
 *
 * Raw local ESRCH, presence, remote ownership and faithfully invalid records
 * determine removal or protection before the recorded selection is compared.
 * Missing, foreign or malformed trace frames fail. The independently admitted
 * main owner and retained record population prevent another generation from
 * certifying this scan. One ordered pass distinguishes complete absence from a
 * conservative short circuit; the membership set rejects duplicate records.
 * Each invocation supplies its own scan, without another PID probe or OS branch.
 * The caller owns process joins and retained files.
 */
function assertRuntimeCleanupEligibility(
  rows: Record<string, any>[],
  expected: { launcher: number; owner: number; hostname: string; directory: string;
    cache: string; argv: string[]; cwd: string; ownerNames?: string[] },
): boolean {
  assert.ok(rows.length >= 6, "cleanup must retain its complete original invocation");
  const first = rows[0]!;
  assert.ok(Number.isSafeInteger(first.sequence) && first.sequence > 0);
  const seen = new Set<string>();
  let unknown = false;
  let live = false;
  for (const [index, row] of rows.entries()) {
    assert.equal(row.schema, 1);
    assert.equal(row.event, "runtime-cleanup");
    assert.equal(row.writerPid, expected.launcher);
    assert.equal(row.pid, expected.launcher);
    assert.equal(row.instance, first.instance);
    assert.equal(row.invocation, first.invocation);
    assert.ok(typeof row.instance === "string" && row.invocation.startsWith(row.instance + ":"));
    assert.equal(row.sequence, first.sequence + index, "no cleanup frame may be missing");
    assert.deepEqual(row.argv, expected.argv);
    assert.equal(row.cwd, expected.cwd);
    assert.equal(row.data.origin, "ttsx-runtime-cleanup");
    assert.equal(row.data.directory, expected.directory);
    assert.equal(row.data.runtimeCacheDir, expected.cache);
    assert.equal(row.data.errorCode, undefined);
    assert.equal(row.data.errorMessage, undefined);
  }
  assert.equal(rows[0]!.data.phase, "attempt");
  assert.equal(rows[1]!.data.phase, "lock-entered");
  const observations = rows.slice(2, -3);
  assert.ok(observations.length > 0, "the actual main owner cannot be an unowned run");
  for (const row of observations) {
    assert.equal(row.data.phase, "owner-observation");
    assert.equal(live, false, "a scan stops at its first non-gone owner");
    const observation = row.data.ownerObservation;
    assert.ok(observation && typeof observation.record === "string" && observation.record === path.basename(observation.record) && observation.record.startsWith("owner-") && observation.record.endsWith(".json"));
    assert.equal(seen.has(observation.record), false);
    seen.add(observation.record);
    assert.notEqual(observation.record, `owner-${expected.launcher}.json`, "the completed CLI relinquishes only its own claim");
    if (observation.result === "invalid-record") {
      assert.equal(observation.owner, undefined);
      unknown = true;
      continue;
    }
    assert.ok(observation.owner && Number.isSafeInteger(observation.owner.pid) && observation.owner.pid > 0);
    assert.equal(observation.record, `owner-${observation.owner.pid}.json`);
    assert.ok(typeof observation.owner.hostname === "string" && observation.owner.hostname.length > 0);
    if (observation.result === "remote") {
      assert.notEqual(observation.owner.hostname.toLowerCase(), expected.hostname.toLowerCase());
      assert.equal(observation.errorCode, undefined);
      live = true;
    } else {
      assert.equal(observation.owner.hostname.toLowerCase(), expected.hostname.toLowerCase());
      if (observation.result === "absent") assert.equal(observation.errorCode, "ESRCH");
      else {
        assert.ok(observation.result === "present" || observation.result === "unknown");
        if (observation.result === "present") assert.equal(observation.errorCode, undefined);
        else assert.notEqual(observation.errorCode, "ESRCH");
        live = true;
      }
    }
  }
  const retained = live || unknown;
  const ownership = live ? "live" : unknown ? "unknown" : "abandoned";
  assert.deepEqual(rows.slice(-3).map((row) => [row.data.phase, row.data.ownership]),
    [["ownership", ownership], [retained ? "retained" : "removed", ownership], ["completed", undefined]]);
  if (retained) {
    const ownerNames = expected.ownerNames;
    assert.ok(ownerNames, "a protected run must retain its owner records");
    assert.ok(ownerNames.includes(`owner-${expected.owner}.json`), "the original main owner must remain independently recorded");
    assert.deepEqual(ownerNames.slice(0, observations.length), [...seen]);
    if (!live) assert.equal(ownerNames.length, observations.length);
  } else {
    assert.ok(seen.has(`owner-${expected.owner}.json`), "every recognized owner, including the original main, must prove ESRCH");
    assert.equal(expected.ownerNames, undefined);
  }
  return retained;
}
