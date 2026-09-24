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
  readCapabilityResolution(options: IKey): object | null;
};
const { writeCapabilityResolution } = require_(
  path.join(ttscLib, "plugin", "internal", "writeCapabilityResolution.js"),
) as {
  writeCapabilityResolution(
    options: IKey,
    answer: {
      hostInputs: string[];
      manifest: string;
      pluginSources: Record<string, string>;
      plugins: { binary: string; capabilities: Record<string, boolean> }[];
      projectContext: string | null;
    },
  ): void;
};

interface IKey {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  tsconfig: string;
  version: string;
}

/**
 * Verifies a cached capability answer proves its plugin sources without reading
 * their files while the files' metadata holds, and reads them once it moves
 * (samchon/ttsc#1492).
 *
 * The answer is proven by the state of every directory its binaries were keyed
 * on, which a full proof reads byte by byte: half a second for `@ttsc/lint`'s
 * module on every read, where a graph session reads it on every republish. The
 * entry records the digest with the metadata signature of exactly the files it
 * read, taken when every stamp had provably left its clock tick, and a read
 * whose signature still matches hands the recorded digest to the proof. What
 * the read used is observed through the entry itself: a recorded digest that
 * does not describe the files refutes the entry exactly when the read trusted
 * it, and changes nothing when the read went to the files.
 *
 * 1. Record an entry for a module whose stamps lie in the past, and assert a read
 *    answers from it.
 * 2. Replace the recorded digest with one no file produces, keeping its signature,
 *    and assert the read refuses the entry: it took the digest rather than
 *    reading the files.
 * 3. Record again, rewrite a file with the same bytes, which moves its metadata
 *    alone, replace the recorded digest again, and assert the read answers: it
 *    read the files, which still give the recorded state.
 * 4. Edit a file, and assert the read refuses the entry.
 */
export const test_capabilityresolutioncache_reads_plugin_sources_only_when_their_metadata_moved =
  (): void => {
    const cwd = TestProject.tmpdir("ttsc-capability-source-reads-");
    const cache = path.join(cwd, "cache");
    const module = path.join(cwd, "plugin-module");
    const binary = path.join(cwd, "plugin.exe");
    const tsconfig = path.join(cwd, "tsconfig.json");
    write(tsconfig, "{}");
    write(binary, "binary");
    write(
      path.join(module, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(module, "cmd", "plugin", "main.go"), "package main\n");
    write(path.join(module, "internal", "mark", "mark.go"), "package mark\n");
    const files = [
      path.join(module, "go.mod"),
      path.join(module, "cmd", "plugin", "main.go"),
      path.join(module, "internal", "mark", "mark.go"),
    ];
    /** Move every stamp an hour back, out of any tick a reference minted now. */
    const settle = (): void => {
      const past = new Date(Date.now() - 3_600_000);
      for (const file of files) fs.utimesSync(file, past, past);
    };
    const key: IKey = {
      cwd,
      env: { TTSC_CACHE_DIR: cache },
      tsconfig: "tsconfig.json",
      version: "1.2.3",
    };
    const record = (): void =>
      writeCapabilityResolution(key, {
        hostInputs: [tsconfig],
        manifest: "[]",
        pluginSources: { [module]: pluginSourceState(module) },
        plugins: [{ binary, capabilities: { graphNodes: true } }],
        projectContext: null,
      });
    const answers = (): boolean => readCapabilityResolution(key) !== null;
    /** Replace the recorded digest with one that describes no file. */
    const misrecord = (): void => {
      const file = entryFile(cache);
      const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
        pluginSources: Record<string, { digest?: string; signature?: string }>;
      };
      const source = entry.pluginSources[module]!;
      assert.equal(typeof source.signature, "string", "a signature was kept");
      source.digest = "0".repeat(64);
      fs.writeFileSync(file, JSON.stringify(entry), "utf8");
    };

    // 1. A hit.
    settle();
    record();
    assert.equal(answers(), true);

    // 2. The hit trusted the recorded digest: a wrong one refutes it.
    misrecord();
    assert.equal(answers(), false, "the read went to the files");

    // 3. Moved metadata sends the read to the files, whatever was recorded.
    settle();
    record();
    write(files[1]!, "package main\n");
    misrecord();
    assert.equal(answers(), true, "the read trusted a digest its files moved");

    // 4. A real edit refuses the entry.
    settle();
    record();
    write(files[2]!, "package mark\n\n// edited\n");
    assert.equal(answers(), false);
  };

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

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
