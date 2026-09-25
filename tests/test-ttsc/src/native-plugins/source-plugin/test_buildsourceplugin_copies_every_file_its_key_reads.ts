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
