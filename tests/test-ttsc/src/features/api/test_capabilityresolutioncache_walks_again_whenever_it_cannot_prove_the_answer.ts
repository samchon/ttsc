import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pluginSourceState } from "ttsc/plugin-source";

const require_ = createRequire(import.meta.url);
const ttscLib = path.dirname(require_.resolve("ttsc"));
const { readCapabilityResolution } = require_(
  path.join(ttscLib, "plugin", "internal", "readCapabilityResolution.js"),
) as {
  readCapabilityResolution(options: IKey): IEntry | null;
};
const { writeCapabilityResolution } = require_(
  path.join(ttscLib, "plugin", "internal", "writeCapabilityResolution.js"),
) as {
  writeCapabilityResolution(options: IKey, answer: IAnswer): void;
};

const { hashHostInputPaths } = require_(
  path.join(ttscLib, "plugin", "internal", "load", "hashHostInputPaths.js"),
) as {
  hashHostInputPaths(inputs: readonly string[]): Record<string, string | null>;
};
const { realpathHostInputPaths } = require_(
  path.join(ttscLib, "plugin", "internal", "load", "realpathHostInputPaths.js"),
) as {
  realpathHostInputPaths(
    inputs: readonly string[],
  ): Record<string, string | null>;
};
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
 * A recorded binary path is keyed on the whole Go module of its plugin, every
 * contributor's source, and the Go build environment, and the entry used to
 * prove only the plugin's `source` by a fingerprint of its own, blind to every
 * dot directory: an edit to a sibling package, a generated source below a dot
 * directory, or another `GOFLAGS` kept handing out the old binary, which the
 * build cache still holds (samchon/ttsc#1492). The entry now records the states
 * the load reported for those directories (`pluginSources`) and proves them by
 * the build's own rule.
 *
 * So every case here is a negative one but two. An unchanged project answers
 * from the entry, which proves the cache is reachable at all, because a cache
 * that never hits would pass every other case in this file; and a write the
 * build never reads keeps the answer.
 *
 * 1. Record an answer for a project and read it back unchanged.
 * 2. Edit the tsconfig it was recorded against.
 * 3. Add a manifest that discovery would newly read.
 * 4. Delete a recorded input.
 * 5. Edit the plugin's own package, a sibling package of its module, the module's
 *    `go.mod`, and a source below a dot directory, add a file, and change the
 *    Go build environment, none of which any host input tracks.
 * 6. Write below the module's `node_modules`, and require the entry to still
 *    answer.
 * 7. Remove the built binary the entry names.
 * 8. Corrupt the entry, and bump the build that wrote it.
 * 9. Require every change but the sixth to answer `null`.
 */
export const test_capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer =
  (): void => {
    const cwd = TestProject.tmpdir("ttsc-capability-resolution-");
    const cache = path.join(cwd, "cache");
    const module = path.join(cwd, "plugin-module");
    const binary = path.join(cwd, "plugin.exe");
    const tsconfig = path.join(cwd, "tsconfig.json");
    const manifest = path.join(cwd, "package.json");

    write(tsconfig, JSON.stringify({ compilerOptions: {} }));
    write(manifest, JSON.stringify({ name: "fixture" }));
    write(
      path.join(module, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    write(path.join(module, "internal", "mark", "mark.go"), "package mark\n");
    write(path.join(module, ".generated", "gen.go"), "package generated\n");
    write(path.join(module, "node_modules", "pkg", "index.js"), "\n");
    write(binary, "binary");

    const key: IKey = {
      cwd,
      env: { TTSC_CACHE_DIR: cache },
      tsconfig: "tsconfig.json",
      version: "1.2.3",
    };
    // Each record is what a fresh load reports: the module's state now.
    const record = (): void =>
      writeCapabilityResolution(key, {
        hostInputHashes: hashHostInputPaths([tsconfig, manifest]),
        hostInputRealpaths: realpathHostInputPaths([tsconfig, manifest]),
        hostInputs: [tsconfig, manifest],
        manifest: '[{"name":"@ttsc/lint","stage":"check"}]',
        pluginSources: { [module]: pluginSourceState(module) },
        plugins: [{ binary, capabilities: { graphNodes: true } }],
        projectContext: '{"physicalProjectRoot":"/fixture"}',
      });
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

    // 5. What the binary was keyed on, which no host input can see. The binary
    // path is keyed on it, so a change here means the answer names a binary
    // the build would no longer produce, and the old one is still on disk, so
    // existence cannot notice it either.
    verifyWalksAgain(record, read, "the plugin's own package", () =>
      write(
        path.join(module, "cmd", "plugin", "main.go"),
        "package main\n\nfunc main() {}\n",
      ),
    );
    verifyWalksAgain(record, read, "a sibling package of its module", () =>
      write(
        path.join(module, "internal", "mark", "mark.go"),
        "package mark\n\n// edited\n",
      ),
    );
    verifyWalksAgain(record, read, "the module's go.mod", () =>
      fs.appendFileSync(path.join(module, "go.mod"), "\n// edited\n"),
    );
    verifyWalksAgain(record, read, "a source below a dot directory", () =>
      write(
        path.join(module, ".generated", "gen.go"),
        "package generated\n\n// edited\n",
      ),
    );
    verifyWalksAgain(record, read, "a new file in the module", () =>
      write(path.join(module, "extra.go"), "package main\n"),
    );
    const goflags = process.env.GOFLAGS;
    try {
      verifyWalksAgain(record, read, "the Go build environment", () => {
        process.env.GOFLAGS = "-tags=ttsc_capability_cache_probe";
      });
    } finally {
      if (goflags === undefined) delete process.env.GOFLAGS;
      else process.env.GOFLAGS = goflags;
    }

    // 6. What the build never reads keeps the answer.
    record();
    write(path.join(module, "node_modules", "pkg", "index.js"), "// moved\n");
    assert.notEqual(
      read(),
      null,
      "a write below node_modules, which the build never reads, discarded the answer",
    );

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
    verifyWalksAgain(
      record,
      read,
      "an entry recording no inputs at all",
      () => {
        const entry = JSON.parse(
          fs.readFileSync(entryFile(cache), "utf8"),
        ) as IEntry & {
          hostInputHashes: Record<string, string | null>;
          hostInputRealpaths: Record<string, string | null>;
          hostInputs: string[];
          hostInputHashes: Record<string, string | null>;
          hostInputRealpaths: Record<string, string | null>;
        };
        entry.hostInputs = [];
        entry.hostInputHashes = {};
        entry.hostInputRealpaths = {};
        entry.pluginSources = {};
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
