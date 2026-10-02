import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { hashPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/hashPluginBuildEnvironment";
import { computeCacheKey } from "../../../../../packages/ttsc/src/plugin/internal/source/computeCacheKey";

/**
 * Verifies the plugin build environment hashes every program a C toolchain
 * command names, not only the first.
 *
 * Go runs `CC` and its siblings as a command and arguments split by its own
 * quoting rule, so `wrapper compiler` runs a launcher that delegates to a
 * compiler named later. The key hashed only the first program, so replacing the
 * delegated compiler kept serving a binary built by the old one
 * (samchon/ttsc#1555). A flag, which names no file, stays part of the command's
 * text.
 *
 * 1. Hash an environment whose `CC` is a quoted launcher, a flag, and a compiler.
 * 2. Change only the compiler's bytes, then only the flag.
 * 3. Assert each change moves the digest, and an unchanged environment keeps it.
 * 4. Call computeCacheKey with one CC name selected from two PATH roots and
 *    require different compiler bytes to change the complete plugin key.
 *
 * @evidence contracts/testing.md#behavioral-verification Unchanged quoted launcher/flag/compiler command keeps its digest; delegated compiler bytes and flag text independently invalidate it. The actual computeCacheKey consumer must also invalidate when the same CC command resolves through PATH to different authored compiler bytes, and preserve an unchanged selection.
 * @evidence contracts/testing.md#independent-expectations Go CC command words can delegate compilation to a later executable; changing that executable or optimization flag changes build input independently of the launcher bytes. Handwritten alpha/bravo files under separate PATH roots independently establish different selected compiler content despite identical CC text.
 * @evidence contracts/testing.md#distinguishing-cases An identical CC command reproduces its digest; changing only the delegated compiler's bytes and then only the -O2 to -O3 flag each move it while the launcher bytes stay fixed. The former external-tool E2E's same-command/different-PATH identity distinction executes through computeCacheKey here; effective go env transport remains in its dedicated E2E.
 * @evidence contracts/testing.md#execution-ownership A unit test calling hashPluginBuildEnvironment and computeCacheKey with goBinary undefined and explicit environments over call-owned fixture files. The plugin manifest has no replace directives, so no Go process, native build or consumer host is involved. TestProject owns the temporary tree's exit cleanup; no ambient PATH or CC is changed.
 */
export function test_hashpluginbuildenvironment_hashes_every_program_a_c_command_names() {
  const root = TestProject.tmpdir("ttsc-cc-command-");
  const launcher = path.join(root, "tool dir", "launcher.cmd");
  const compiler = path.join(root, "compiler.cmd");
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, "launcher\n");
  fs.writeFileSync(compiler, "compiler-a\n");
  const digest = (cc: string): string => {
    const hash = crypto.createHash("sha256");
    hashPluginBuildEnvironment(
      hash,
      undefined,
      root,
      { CC: cc, CGO_ENABLED: "1" },
      { readFile: (file) => fs.readFileSync(file) },
    );
    return hash.digest("hex");
  };
  const command = (flag: string) => `"${launcher}" ${flag} "${compiler}"`;

  const first = digest(command("-O2"));
  assert.equal(digest(command("-O2")), first, "an unchanged command");
  fs.writeFileSync(compiler, "compiler-b\n");
  const replaced = digest(command("-O2"));
  assert.notEqual(replaced, first, "the delegated compiler is hashed");
  assert.notEqual(digest(command("-O3")), replaced, "a flag is command text");
  const plugin = path.join(root, "plugin");
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "unit", "hashpluginbuildenvironment_hashes_every_program_a_c_command_names", "inputs-1"), root);
  fs.renameSync(path.join(plugin, "main.go.txt"), path.join(plugin, "main.go"));
  assert.equal(fs.readFileSync(path.join(plugin, "go.mod"), "utf8"), "module example.com/plugin\n\ngo 1.26\n");
  assert.equal(fs.readFileSync(path.join(plugin, "main.go"), "utf8"), "package main\n");
  const toolName = process.platform === "win32" ? "mycc.exe" : "mycc";
  const firstToolDir = path.join(root, "first");
  const secondToolDir = path.join(root, "second");
  for (const [directory, bytes] of [[firstToolDir, "alpha"], [secondToolDir, "bravo"]] as const) {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, toolName), bytes);
  }
  const key = (toolDirectory: string): string => computeCacheKey({
    dir: plugin, entry: ".", env: { CC: toolName, PATH: toolDirectory },
    ttscVersion: "1.0.0", tsgoVersion: "7.0.0-dev",
  });
  const selected = key(firstToolDir);
  assert.equal(key(firstToolDir), selected, "an unchanged PATH selection stays stable");
  assert.notEqual(key(secondToolDir), selected, "PATH-selected compiler bytes reach the complete key");
}
