import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";
import { readCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/readCapabilityResolution";
import { writeCapabilityResolution } from "../../../../../packages/ttsc/src/plugin/internal/writeCapabilityResolution";
import { TestProject } from "../../../../utils/src/TestProject";

interface IKey {
  cwd: string;
  tsconfig: string;
  version: string;
  env?: NodeJS.ProcessEnv;
}

interface IAnswer {
  hostInputHashes: Record<string, string | null>;
  hostInputRealpaths: Record<string, string | null>;
  hostInputs: string[];
  manifest: string;
  pluginSources: Record<string, string>;
  projectContext: string | null;
  plugins: {
    binary: string;
    capabilities: Record<string, boolean>;
  }[];
}

interface IEntry extends Omit<IAnswer, "pluginSources"> {
  pluginSources: Record<string, { state: string }>;
  version: string;
}

/**
 * Verifies capability entries fail closed on host inputs, missing binaries and
 * invalid format.
 *
 * A cached capability answer may be believed only while every input it was
 * proved against still holds. An entry that records no inputs proves nothing,
 * because two empty states always agree, so it must be refused on its shape.
 *
 * 1. Record an entry over a tsconfig, a manifest and a binary and require it to
 *    hit with the declaration it was recorded with.
 * 2. Re-record a valid entry before each change, then change the tsconfig, change
 *    and delete the manifest, delete the binary, corrupt the entry and empty
 *    its recorded inputs, requiring the cache to decline each time.
 * 3. Read the entry under another ttsc version and require a miss.
 *
 * @evidence contracts/testing.md#behavioral-verification writeCapabilityResolution then readCapabilityResolution run over real files in a temp cache: an unchanged entry hits and returns the recorded graphNodes declaration, while a changed tsconfig, a changed manifest, a deleted manifest, a deleted plugin binary, unparseable JSON and an entry rewritten with empty hostInputs/hashes/realpaths each make the reader return null.
 * @evidence contracts/testing.md#independent-expectations The expected outcomes follow from the cache's fail-closed rule rather than from its code: every authored mutation (rewritten file bytes, rmSync, a literal '{not json', a hand-emptied entry, version 1.2.3 versus 1.2.4) must produce null, and verifyWalksAgain first asserts the re-recorded entry is non-null so each null is attributable to that one change.
 * @evidence contracts/testing.md#distinguishing-cases The positive case is the unchanged entry (a hit with graphNodes true, and again before every mutation); the negatives differ by property: input content, input presence, binary presence, entry syntax, an empty input proof and the product version. Entries that record pluginSources are not exercised here because every entry this test records carries an empty pluginSources; test_capabilityresolutioncache_refuses_a_plugin_source_whose_state_no_longer_holds owns that refusal.
 * @evidence contracts/testing.md#execution-ownership A unit test: it calls the TypeScript reader, writer and host-input hashing helpers directly over files in a private temp directory with TTSC_CACHE_DIR pointing at it; it starts no process, Go build or ttsc host.
 */
export function test_capabilityresolutioncache_refuses_unproved_host_inputs_and_format() {
  const cwd = TestProject.tmpdir("ttsc-capability-resolution-inputs-");
  const cache = path.join(cwd, "cache");
  const binary = path.join(cwd, "plugin.exe");
  const tsconfig = path.join(cwd, "tsconfig.json");
  const manifest = path.join(cwd, "package.json");
  write(tsconfig, JSON.stringify({ compilerOptions: {} }));
  write(manifest, JSON.stringify({ name: "fixture" }));
  write(binary, "binary");
  const key: IKey = {
    cwd,
    env: { TTSC_CACHE_DIR: cache },
    tsconfig: "tsconfig.json",
    version: "1.2.3",
  };
  // Record the host proofs and declaration payload without a source-bearing plugin.
  const record = (): void => {
    writeCapabilityResolution(key, {
      hostInputHashes: hashHostInputPaths([tsconfig, manifest]),
      hostInputRealpaths: realpathHostInputPaths([tsconfig, manifest]),
      hostInputs: [tsconfig, manifest],
      manifest: '[{"name":"@ttsc/lint","stage":"check"}]',
      pluginSources: {},
      plugins: [{ binary, capabilities: { graphNodes: true } }],
      projectContext: '{"physicalProjectRoot":"/fixture"}',
    });
  };
  const read = (): IEntry | null => readCapabilityResolution(key);

  // 1. A hit.
  record();
  const hit = read();
  assert.notEqual(
    hit,
    null,
    "an unchanged project did not answer from the entry it had just written; a cache that never hits proves nothing below",
  );
  assert.equal(
    hit!.plugins[0]?.capabilities.graphNodes,
    true,
    "the entry came back without the declaration it was recorded with",
  );

  // 2-4. The host inputs.
  verifyWalksAgain(record, read, "the tsconfig it was recorded against", () =>
    write(tsconfig, JSON.stringify({ compilerOptions: { strict: true } })),
  );
  verifyWalksAgain(
    record,
    read,
    "a manifest discovery reads, which is where a newly installed plugin appears",
    () => write(manifest, JSON.stringify({ name: "fixture", ttsc: {} })),
  );
  verifyWalksAgain(record, read, "a recorded input that was deleted", () =>
    fs.rmSync(manifest),
  );

  // Restored, because every later case needs an entry that would otherwise
  // be valid.
  write(manifest, JSON.stringify({ name: "fixture" }));

  // 7-8. The binary, and the entry itself.
  verifyWalksAgain(record, read, "the binary the entry names", () =>
    fs.rmSync(binary),
  );

  write(binary, "binary");
  verifyWalksAgain(record, read, "an entry that does not parse", () => {
    write(entryFile(cache), "{not json");
  });
  // An entry that records nothing validates against nothing: every check
  // below compares a recorded state to a fresh one, and two empty states
  // always agree. Such an entry would be permanently valid for a project it
  // has stopped describing, so it is refused on its shape rather than on a
  // comparison that cannot fail.
  verifyWalksAgain(record, read, "an entry recording no inputs at all", () => {
    const entry = JSON.parse(
      fs.readFileSync(entryFile(cache), "utf8"),
    ) as IEntry & {
      hostInputs: string[];
      hostInputHashes: Record<string, string | null>;
      hostInputRealpaths: Record<string, string | null>;
    };
    entry.hostInputs = [];
    entry.hostInputHashes = {};
    entry.hostInputRealpaths = {};
    entry.pluginSources = {};
    write(entryFile(cache), JSON.stringify(entry));
  });

  record();
  assert.notEqual(
    read(),
    null,
    "the version control must hit before changing the version",
  );
  assert.equal(
    readCapabilityResolution({ ...key, version: "1.2.4" }),
    null,
    "an entry written by another ttsc build was believed; discovery can change between builds",
  );
}

/**
 * Re-record a valid entry, apply one change, and require the cache to decline.
 *
 * Re-recording first is what makes each case prove its own change rather than
 * inherit the previous one's invalidation.
 */
function verifyWalksAgain(
  record: () => void,
  read: () => IEntry | null,
  what: string,
  change: () => void,
): void {
  record();
  assert.notEqual(
    read(),
    null,
    `${what}: the entry was invalid before the change`,
  );
  change();
  assert.equal(
    read(),
    null,
    `${what} changed and the cache still answered; a stale answer here is indistinguishable from a correct one`,
  );
}

/** The single entry the fixture writes, whatever its key hashes to. */
function entryFile(cache: string): string {
  const directory = path.join(cache, "capabilities");
  const entries = fs.readdirSync(directory).filter((n) => n.endsWith(".json"));
  assert.equal(
    entries.length,
    1,
    `expected one entry, got ${entries.join(",")}`,
  );
  return path.join(directory, entries[0]!);
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}
