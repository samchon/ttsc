import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildSourcePlugin } from "../../../../../packages/ttsc/src/plugin/internal/source/buildSourcePlugin";
import { pluginModuleReplaceDirectories } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginModuleReplaceDirectories";

/**
 * Verify that Go's bare dot replacements retain their original module roots.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads both directives with Go and builds the child through the normal source build. The recorded source digest and runnable binary prove that the declared parent was keyed and its source reached the generated workspace.
 * @evidence contracts/testing.md#independent-expectations The parent module supplies the executable's expected output, and the child imports it through an authored bare parent directive. The test locates the parent's digest and confirms the original manifest stayed untouched.
 * @evidence contracts/testing.md#distinguishing-cases The bare dot remains inside the child. The bare parent requires an independent source population and a rewritten scratch manifest because the scratch parent contains no dependency module.
 * @evidence contracts/testing.md#execution-ownership One temporary project owns both modules and the build's binary cache. One native compilation runs with a local Go toolchain and no remote modules.
 */
export function test_buildsourceplugin_keeps_bare_parent_replacement(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-parent-replace-")),
  );
  const dependency = path.join(root, "dep");
  const source = path.join(dependency, "child");
  const manifest = path.join(source, "go.mod");
  const head = "module example.com/child\n\ngo 1.25\n";
  const original =
    head + "\nrequire example.com/dep v0.0.0\nreplace example.com/dep => ..\n";
  const env = { ...process.env, GOENV: "off", GOTOOLCHAIN: "local" };
  try {
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(
      path.join(dependency, "go.mod"),
      "module example.com/dep\n\ngo 1.25\n",
    );
    fs.writeFileSync(
      path.join(dependency, "message.go"),
      'package dep\n\nconst Message = "original parent module"\n',
    );
    fs.writeFileSync(
      path.join(source, "main.go"),
      'package main\n\nimport ("fmt"; "example.com/dep")\n\nfunc main() { fmt.Println(dep.Message) }\n',
    );
    fs.writeFileSync(manifest, head + "\nreplace example.com/child => .\n");
    assert.deepEqual(pluginModuleReplaceDirectories(source, env), []);
    fs.writeFileSync(manifest, original);
    assert.deepEqual(pluginModuleReplaceDirectories(source, env), [
      { directory: dependency, modulePath: "example.com/dep", spelled: ".." },
    ]);

    const sourceDigests = new Map<string, string>();
    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir: path.join(root, "cache"),
      env,
      overlayDirs: [],
      pluginName: "bare-parent",
      quiet: true,
      source,
      sourceDigests,
      ttscVersion: "unit",
      tsgoVersion: "unit",
    });
    assert.ok(sourceDigests.has(dependency));
    assert.equal(
      execFileSync(binary, { encoding: "utf8", windowsHide: true }).trim(),
      "original parent module",
    );
    assert.equal(fs.readFileSync(manifest, "utf8"), original);
  } finally {
    fs.rmSync(root, { recursive: true });
  }
}
