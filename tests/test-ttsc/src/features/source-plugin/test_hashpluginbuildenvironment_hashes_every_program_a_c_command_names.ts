import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { hashPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/hashPluginBuildEnvironment";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Unchanged quoted launcher/flag/compiler command keeps its digest; delegated compiler bytes and flag text independently invalidate it.
 * @evidence contracts/testing.md#independent-expectations Go CC command words can delegate compilation to a later executable; changing that executable or optimization flag changes build input independently of the launcher bytes.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged quoted launcher/flag/compiler command keeps its digest; delegated compiler bytes and flag text independently invalidate it.
 * @evidence contracts/testing.md#execution-ownership This matching named source-unit entry directly executes the authored hashing owner over fixture bytes without a Go executable, native artifact or consumer host; actual build and toolchain probes remain separate boundaries.
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
  const command = (flag: string) => `"${launcher}" ${flag} ${compiler}`;

  const first = digest(command("-O2"));
  assert.equal(digest(command("-O2")), first, "an unchanged command");
  fs.writeFileSync(compiler, "compiler-b\n");
  const replaced = digest(command("-O2"));
  assert.notEqual(replaced, first, "the delegated compiler is hashed");
  assert.notEqual(digest(command("-O3")), replaced, "a flag is command text");
}
