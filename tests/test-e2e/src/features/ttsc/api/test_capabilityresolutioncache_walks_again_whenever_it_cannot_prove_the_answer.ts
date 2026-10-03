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
 * Verifies recorded capabilities still describe their contributor sources and build environment.
 *
 * @evidence contracts/testing.md#behavioral-verification An unchanged source-bearing answer hits; edits to own/sibling/module/dot/new sources and GOFLAGS refuse it while node_modules changes remain irrelevant.
 * @evidence contracts/testing.md#independent-expectations Literal Go source edits and an explicit effective GOFLAGS transition establish changed build inputs independently; each transition first asserts that the previous state is accepted.
 * @evidence contracts/testing.md#distinguishing-cases Five source-selection distinctions, a real environment change and the pruned node_modules control retain their original assertions. Host-input, binary-presence, malformed/empty/version proofs execute in test_capabilityresolutioncache_refuses_unproved_host_inputs_and_format.
 * @evidence contracts/testing.md#execution-ownership This E2E-selected entry directly calls built cache/source-state operations with actual file and Go environment inputs. tests/test-ttsc/src/features/api/test_capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer.ts directly executes their authored owners with the original source/environment/pruning matrix and exact effective-environment restoration; no compiler artifact or product host is needed.
 * @evidence contracts/e2e.md#necessary-boundary Real source/GOFLAGS observations are inputs to this direct owning cache operation, not an installed-consumer or native producer protocol. The authored source unit preserves actual Go queries and filesystem mutations; a supplied digest alone is not its replacement.
 * @evidence contracts/e2e.md#shared-execution All original distinctions retain their recorded-answer and mutable module setup, with fresh pre-change controls. Go/toolchain query cost remains with direct-unit execution; shared runner or tool path does not prove executable-byte equality, query totals or before/after process savings.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project/cache/module paths isolate mutations; each changed premise is freshly recorded and asserted valid before alteration, and GOFLAGS is restored in finally. No environment witness or freshness check is bypassed.
 * @evidence contracts/e2e.md#preserved-coverage Original source/environment/pruning assertions remain here and in the named direct owner, with historical queue051 execution recorded separately. The separately named host/format/binary unit has its own selection and execution evidence, not certification by this entry. No duplicate is removed until actual selected survival is established.
 */
export function test_capabilityresolutioncache_walks_again_whenever_it_cannot_prove_the_answer() {
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
