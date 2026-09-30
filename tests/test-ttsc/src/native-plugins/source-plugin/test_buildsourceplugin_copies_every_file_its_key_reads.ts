import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../internal/source-build";

/**
 * Verifies a plugin build's copy of its source holds exactly the files the
 * binary is keyed on, so a source whose entries a name alone misjudges builds.
 *
 * A build verifies its copy against the digest the key read of the source, and
 * refuses to publish a binary when they differ (samchon/ttsc#1505). The copy
 * judged every entry by its name: it left out a `.git` file, which the root of
 * a Git worktree or submodule holds and the key reads as any file, and a
 * directory named like an editor backup, which the key's walk enters. Every
 * build of such a source then failed as edited while it was built.
 *
 * 1. Write a plugin module holding a `.git` file at its root and a directory named
 *    `notes~` with a file in it.
 * 2. Build it.
 * 3. Assert the build publishes its binary.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin publishes through a fake Go process that requires standard source paths, while a .git file and notes~ directory remain digest-compatible.
 * @evidence contracts/testing.md#independent-expectations The fake process independently requires four copied paths; .git and notes~ inputs must not make copy validation diverge from the keyed source.
 * @evidence contracts/testing.md#distinguishing-cases File-shaped .git and directory-shaped backup-like name exercise entry-kind distinctions; this is publication/copy transport, not proof of Go compilation.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_copies_every_file_its_key_reads entry is discovered by TestExecutor from source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. Calls that change source, cache ownership, environment or tool permissions retain distinct observations because those are the inputs under test. The fake subprocess fixtures avoid unnecessary native compilation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage buildSourcePlugin publishes through a fake Go process that requires standard source paths, while a .git file and notes~ directory remain digest-compatible. These assertions stay in test_buildsourceplugin_copies_every_file_its_key_reads with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_buildsourceplugin_copies_every_file_its_key_reads = () => {
  const root = TestProject.tmpdir("ttsc-plugin-copy-by-key-");
  const plugin = path.join(root, "plugin");
  write(path.join(plugin, "go.mod"), "module example.com/plugin\n\ngo 1.26\n");
  write(path.join(plugin, "main.go"), "package main\n");
  // The files the fake Go build requires of the module it compiles.
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ])
    write(path.join(plugin, relative), "package generated\n");
  write(path.join(plugin, ".git"), "gitdir: ../.git/worktrees/plugin\n");
  write(path.join(plugin, "notes~", "notes.txt"), "kept notes\n");
  const fakeGo = path.join(root, "fake-go");
  fs.mkdirSync(fakeGo, { recursive: true });

  const binary = buildSourcePlugin({
    baseDir: root,
    cacheDir: path.join(root, "cache"),
    env: {
      ...process.env,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
    },
    overlayDirs: [],
    pluginName: "copied-by-key",
    quiet: true,
    source: plugin,
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  assert.ok(fs.existsSync(binary), "the module builds and publishes");
};

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
