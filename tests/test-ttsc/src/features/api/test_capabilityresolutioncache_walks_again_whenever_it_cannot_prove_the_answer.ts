import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const ttscLib = path.dirname(require_.resolve("ttsc"));
const { readCapabilityResolution, writeCapabilityResolution } = require_(
  path.join(ttscLib, "plugin", "internal", "capabilityResolutionCache.js"),
) as {
  readCapabilityResolution(options: IKey): IEntry | null;
  writeCapabilityResolution(options: IKey, answer: IAnswer): void;
};

interface IKey {
  cwd: string;
  tsconfig: string;
  version: string;
  env?: NodeJS.ProcessEnv;
}

interface IAnswer {
  hostInputs: string[];
  manifest: string;
  projectContext: string | null;
  plugins: {
    binary: string;
    capabilities: Record<string, boolean>;
    source: string;
  }[];
}

interface IEntry extends IAnswer {
  version: string;
}

/**
 * Verifies the plugin-resolution cache answers only what it can still prove,
 * and walks the project again whenever it cannot.
 *
 * The walk it replaces reads the project's dependency closure to decide which
 * plugins a project configures, and that costs hundreds of milliseconds on a
 * real repository for an answer that is usually "none". Caching it is worth
 * doing and dangerous to get wrong in one specific direction: a stale entry
 * answers "no plugin declares this capability" for a project that has just
 * configured one, and that wrong answer is byte-identical to the correct answer
 * for the common case. Nothing downstream can tell them apart — which is
 * exactly how the artifact channel shipped delivering nothing for a full
 * cycle.
 *
 * So every case here is a negative one. The single positive — an unchanged
 * project answers from the entry — exists to prove the cache is reachable at
 * all, because a cache that never hits would pass every other case in this
 * file.
 *
 * 1. Record an answer for a project and read it back unchanged.
 * 2. Edit the tsconfig it was recorded against.
 * 3. Add a manifest that discovery would newly read.
 * 4. Delete a recorded input.
 * 5. Edit the plugin's own Go source, which no host input tracks.
 * 6. Remove the built binary the entry names.
 * 7. Corrupt the entry, and bump the build that wrote it.
 * 8. Require every one of those to answer `null`.
 */
export const test_capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer =
  (): void => {
    const cwd = TestProject.tmpdir("ttsc-capability-resolution-");
    const cache = path.join(cwd, "cache");
    const source = path.join(cwd, "plugin-source");
    const binary = path.join(cwd, "plugin.exe");
    const tsconfig = path.join(cwd, "tsconfig.json");
    const manifest = path.join(cwd, "package.json");

    write(tsconfig, JSON.stringify({ compilerOptions: {} }));
    write(manifest, JSON.stringify({ name: "fixture" }));
    write(path.join(source, "main.go"), "package main\n");
    write(binary, "binary");

    const key: IKey = {
      cwd,
      env: { TTSC_CACHE_DIR: cache },
      tsconfig: "tsconfig.json",
      version: "1.2.3",
    };
    const answer: IAnswer = {
      hostInputs: [tsconfig, manifest],
      manifest: '[{"name":"@ttsc/lint","stage":"check"}]',
      plugins: [{ binary, capabilities: { graphNodes: true }, source }],
      projectContext: '{"physicalProjectRoot":"/fixture"}',
    };

    const record = (): void => writeCapabilityResolution(key, answer);
    const read = (): IEntry | null => readCapabilityResolution(key);

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

    // The one change no host input can see. The binary path is content-keyed on
    // this source, so an edit here means the answer names a binary the build
    // would no longer produce — and the old one is still on disk, so existence
    // cannot notice it either.
    verifyWalksAgain(record, read, "the plugin's own Go source", () =>
      write(path.join(source, "main.go"), "package main\n\nfunc main() {}\n"),
    );
    verifyWalksAgain(record, read, "a new file in the plugin's source", () =>
      write(path.join(source, "extra.go"), "package main\n"),
    );
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
    verifyWalksAgain(
      record,
      read,
      "an entry recording no inputs at all",
      () => {
        const entry = JSON.parse(
          fs.readFileSync(entryFile(cache), "utf8"),
        ) as IEntry & {
          hostInputs: string[];
          hostInputHashes: Record<string, string | null>;
          hostInputRealpaths: Record<string, string | null>;
          sources: Record<string, string>;
        };
        entry.hostInputs = [];
        entry.hostInputHashes = {};
        entry.hostInputRealpaths = {};
        entry.sources = {};
        write(entryFile(cache), JSON.stringify(entry));
      },
    );

    record();
    assert.equal(
      readCapabilityResolution({ ...key, version: "1.2.4" }),
      null,
      "an entry written by another ttsc build was believed; discovery can change between builds",
    );
  };

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
