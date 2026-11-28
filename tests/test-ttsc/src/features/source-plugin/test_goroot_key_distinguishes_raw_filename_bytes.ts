import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import type { SourceBuildFilesystemOperations } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildFilesystemOperations";
import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";

/**
 * Verifies SDK identities distinguish raw POSIX filenames from U+FFFD names.
 *
 * 1. Write a raw-name SDK file and a distinct UTF-8 lookalike.
 * 2. Require stable native and byte-reader reuse and refuse a string-only reader's
 *    proof.
 * 3. Rewrite the raw file in place and repeat under a raw parent directory.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the build key owner with actual SDK entries and validates the resulting environment witnesses before and after an in-place rewrite.
 * @evidence contracts/testing.md#independent-expectations Native Buffer addresses author distinct files with independent content, and the rewrite keeps the valid-name file unchanged. The key must change without an expected production-derived digest.
 * @evidence contracts/testing.md#distinguishing-cases The Linux fixture distinguishes raw names from UTF-8 replacement-character names under both string and raw parents, an unchanged warm hit, an injected reader with byte-path support, and an injected reader restricted to ordinary strings.
 * @evidence contracts/testing.md#execution-ownership The direct source unit creates and removes its own SDK and module. An explicit GOROOT and no Go binary select the identity path without spawning a compiler or writing ambient variables.
 */
export function test_goroot_key_distinguishes_raw_filename_bytes(): void {
  if (process.platform !== "linux") return;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-raw-sdk-entry-"));
  const plugin = path.join(root, "plugin");
  const sdk = path.join(root, "sdk");
  const source = path.join(sdk, "src");
  const raw = Buffer.concat([
    Buffer.from(`${source}/name-`),
    Buffer.from([0xff]),
  ]);
  const unicode = path.join(source, "name-\ufffd");
  const rawDirectory = Buffer.concat([
    Buffer.from(`${source}/directory-`),
    Buffer.from([0xfe]),
  ]);
  const rawDescendant = Buffer.concat([
    rawDirectory,
    Buffer.from("/child-"),
    Buffer.from([0xff]),
    Buffer.from(".go"),
  ]);
  const unicodeDescendant = Buffer.concat([
    rawDirectory,
    Buffer.from("/child-\ufffd.go"),
  ]);
  try {
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(plugin);
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n");
    fs.writeFileSync(unicode, "ordinary bytes\n");
    fs.writeFileSync(raw, "raw first\n");
    const key = (filesystem?: Partial<SourceBuildFilesystemOperations>) => {
      const environmentWitness: PluginBuildEnvironmentWitness.Record =
        new Map();
      const digest = computeCacheKey({
        dir: plugin,
        entry: ".",
        env: { GOROOT: sdk },
        environmentWitness,
        filesystem,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      return { digest, environmentWitness };
    };
    const stringReader = { readFile: fs.readFileSync };
    let readRawEntry = false;
    const byteReader = key({
      ...stringReader,
      readRawFile: (file) => {
        readRawEntry ||= file.equals(raw);
        return fs.readFileSync(file);
      },
    });
    assert.equal(readRawEntry, true);
    assert.equal(
      PluginBuildEnvironmentWitness.reusable(byteReader.environmentWitness),
      true,
    );
    const first = key();
    assert.equal(
      PluginBuildEnvironmentWitness.reusable(first.environmentWitness),
      true,
    );
    assert.equal(byteReader.digest, first.digest);
    assert.equal(key().digest, first.digest);
    assert.equal(
      PluginBuildEnvironmentWitness.holds(key(stringReader).environmentWitness),
      false,
    );
    fs.writeFileSync(raw, "raw payload changed\n");
    assert.equal(fs.readFileSync(unicode, "utf8"), "ordinary bytes\n");
    assert.equal(
      PluginBuildEnvironmentWitness.holds(first.environmentWitness),
      false,
    );
    assert.notEqual(key().digest, first.digest);
    fs.unlinkSync(raw);
    fs.mkdirSync(rawDirectory);
    fs.writeFileSync(rawDescendant, "package first\n");
    fs.writeFileSync(unicodeDescendant, "package literal\n");
    const beforeDescendant = key();
    assert.equal(
      PluginBuildEnvironmentWitness.reusable(
        beforeDescendant.environmentWitness,
      ),
      true,
    );
    fs.writeFileSync(rawDescendant, "package second\n");
    assert.equal(
      fs.readFileSync(unicodeDescendant, "utf8"),
      "package literal\n",
    );
    assert.equal(
      PluginBuildEnvironmentWitness.holds(beforeDescendant.environmentWitness),
      false,
    );
    assert.notEqual(key().digest, beforeDescendant.digest);
    fs.unlinkSync(rawDescendant);
    fs.unlinkSync(unicodeDescendant);
    fs.rmdirSync(rawDirectory);
    const onlyUnicode = key(stringReader);
    assert.equal(
      PluginBuildEnvironmentWitness.reusable(onlyUnicode.environmentWitness),
      true,
    );
    assert.equal(onlyUnicode.digest, key().digest);
  } finally {
    if (fs.existsSync(raw)) fs.unlinkSync(raw);
    if (fs.existsSync(rawDescendant)) fs.unlinkSync(rawDescendant);
    if (fs.existsSync(unicodeDescendant)) fs.unlinkSync(unicodeDescendant);
    if (fs.existsSync(rawDirectory)) fs.rmdirSync(rawDirectory);
    fs.rmSync(root, { recursive: true });
  }
}
