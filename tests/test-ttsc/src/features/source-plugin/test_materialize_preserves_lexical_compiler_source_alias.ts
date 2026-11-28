import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { RuntimeFilesystem } from "../../../../../packages/ttsc/src/launcher/internal/runtime/RuntimeFilesystem";
import { SourcePluginWorkspace } from "../../../../../packages/ttsc/src/plugin/internal/source/SourcePluginWorkspace";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that a POSIX compiler source alias remains usable when its target
 * pathname cannot be represented as UTF-8.
 *
 * 1. Create two byte-named source directories with identical module files.
 * 2. Select and materialize the first through the declared alias.
 * 3. Retarget the alias and verify that the target changes while both copies
 *    preserve the source bytes and own their entries.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the compiler source selector and real workspace materializer through the declared alias, comparing the owned result against the authored bytes.
 * @evidence contracts/testing.md#independent-expectations Literal byte paths and a fixed Go manifest define the expected selections and output. The copy is checked as a regular directory with a regular file.
 * @evidence contracts/testing.md#distinguishing-cases Two same-length non-UTF-8 targets with identical bytes require distinct physical witnesses. Only Windows and a native EILSEQ refusal skip the raw fixture.
 * @evidence contracts/testing.md#execution-ownership One private temporary tree contains the targets, alias and copies. Cleanup uses the authored byte paths without recursing through the alias, and no Go process is needed.
 */
export function test_materialize_preserves_lexical_compiler_source_alias(): void {
  if (process.platform === "win32") return;

  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-materialize-raw-alias-"),
  );
  const alias = path.join(root, "compiler-source");
  const contents = Buffer.from("module github.com/microsoft/typescript-go\n");
  const targets: Array<{ directory: Buffer; manifest: Buffer }> = [];
  const observed: string[] = [];
  try {
    for (const [index, byte] of [0xfe, 0xff].entries()) {
      const directory = Buffer.concat([
        Buffer.from(`${root}/`),
        Buffer.from([byte]),
      ]);
      try {
        fs.mkdirSync(directory);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EILSEQ") return;
        throw error;
      }
      const manifest = Buffer.concat([directory, Buffer.from("/go.mod")]);
      targets.push({ directory, manifest });
      fs.writeFileSync(manifest, contents);

      if (index !== 0) fs.unlinkSync(alias);
      fs.symlinkSync(directory, alias, "dir");
      const source = SourcePluginWorkspace.compilerSource({
        TTSC_TSGO_SOURCE: alias,
      });
      assert.equal(source, alias);
      const witness = RuntimeFilesystem.realpathWitness(source);
      assert.deepEqual(RuntimeFilesystem.rawRealpath(witness), directory);
      observed.push(witness);

      const copy = path.join(root, `copy-${index}`);
      SourcePluginWorkspace.materialize(source, copy);
      assert.ok(fs.lstatSync(copy).isDirectory());
      assert.ok(fs.lstatSync(path.join(copy, "go.mod")).isFile());
      assert.deepEqual(fs.readFileSync(path.join(copy, "go.mod")), contents);
    }
    assert.notEqual(observed[0], observed[1]);
    fs.writeFileSync(path.join(root, "copy-0", "go.mod"), "scratch-only");
    for (const { manifest } of targets)
      assert.deepEqual(fs.readFileSync(manifest), contents);
  } finally {
    if (fs.lstatSync(alias, { throwIfNoEntry: false }) !== undefined)
      fs.unlinkSync(alias);
    for (const { directory, manifest } of targets) {
      if (fs.lstatSync(manifest, { throwIfNoEntry: false }) !== undefined)
        fs.unlinkSync(manifest);
      fs.rmdirSync(directory);
    }
  }
}
