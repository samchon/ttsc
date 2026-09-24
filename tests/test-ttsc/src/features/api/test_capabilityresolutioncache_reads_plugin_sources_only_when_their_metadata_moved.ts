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
 * whose signature still matches hands the digest to the proof. It never trusts
 * a signature it cannot separate from a reference minted at the read.
 *
 * 1. Record an entry for a module whose stamps lie in the past, and assert a read
 *    answers without reading any of its files.
 * 2. Rewrite a file with the same bytes, which moves its metadata alone, and
 *    assert the read still answers, now reading every file.
 * 3. Record again once the stamps settle, and assert no file is read.
 * 4. Edit a file, and assert the read refuses the entry.
 */
export const test_capabilityresolutioncache_reads_plugin_sources_only_when_their_metadata_moved =
  (): void => {
    const cwd = TestProject.tmpdir("ttsc-capability-source-reads-");
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
      env: { TTSC_CACHE_DIR: path.join(cwd, "cache") },
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
    const reads: string[] = [];
    const original = fs.readFileSync;
    /** Read the entry, and count the module's files that read opened. */
    const read = (): { answered: boolean; read: number } => {
      reads.length = 0;
      fs.readFileSync = ((
        file: fs.PathOrFileDescriptor,
        ...rest: unknown[]
      ) => {
        if (typeof file === "string" && file.startsWith(module))
          reads.push(file);
        return (original as (...args: unknown[]) => unknown)(file, ...rest);
      }) as typeof fs.readFileSync;
      try {
        return {
          answered: readCapabilityResolution(key) !== null,
          read: reads.length,
        };
      } finally {
        fs.readFileSync = original;
      }
    };

    // 1. A hit that reads no source file.
    settle();
    record();
    assert.deepEqual(read(), { answered: true, read: 0 });

    // 2. Metadata moved, bytes did not: the files are read, and the answer
    // stands.
    write(files[1]!, "package main\n");
    assert.deepEqual(read(), { answered: true, read: files.length });

    // 3. Settled and recorded again: no read.
    settle();
    record();
    assert.deepEqual(read(), { answered: true, read: 0 });

    // 4. A real edit refuses the entry.
    write(files[2]!, "package mark\n\n// edited\n");
    assert.equal(read().answered, false);
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
