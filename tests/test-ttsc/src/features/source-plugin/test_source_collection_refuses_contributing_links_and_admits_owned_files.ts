import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { collectPluginSourceFiles } from "../../../../../packages/ttsc/src/plugin/internal/source/collectPluginSourceFiles";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source admission rejects contributing links and accepts owned files.
 *
 * 1. Author the original module tree and a shared directory reached by a link.
 * 2. Require the owning source collector and digest to name the refused link.
 * 3. Replace it with copied files and retain the excluded node_modules link.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source collection and digest admission reject the contributing directory alias, then admit the module's own copied bytes while ignoring the pruned alias.
 * @evidence contracts/testing.md#independent-expectations The authored module and literal selected paths/bytes independently establish the admitted population and the original refusal message.
 * @evidence contracts/testing.md#distinguishing-cases A contributing link is refused, an excluded node_modules link is irrelevant, and replacing the first link with owned files is the positive control.
 * @evidence contracts/testing.md#execution-ownership This source unit executes the actual collector/digest decisions with native filesystem identities and starts no compiler or observer. Builder call-order review and the canonical native publication retain the surrounding admission/publication boundary.
 */
export function test_source_collection_refuses_contributing_links_and_admits_owned_files() {
  const root = TestProject.tmpdir("ttsc-plugin-module-link-source-");
  const plugin = path.join(root, "plugin");
  const shared = path.join(root, "shared");
  const authored = new Map([
    ["go.mod", "module example.com/plugin\n\ngo 1.26\n"],
    ["main.go", "package main\n"],
    ["vendor/local/value.go", "package generated\n"],
    ["lib/helper.go", "package generated\n"],
    ["dist/generated.go", "package generated\n"],
    ["build/generated.go", "package generated\n"],
  ]);
  for (const [relative, bytes] of authored)
    write(path.join(plugin, relative), bytes);
  write(path.join(shared, "shared.go"), "package shared\n");
  const link = path.join(plugin, "shared");
  const kind = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(shared, link, kind);
  fs.mkdirSync(path.join(plugin, "node_modules"), { recursive: true });
  fs.symlinkSync(shared, path.join(plugin, "node_modules", "shared"), kind);
  const refused = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("contains a link at") && message.includes(link);
  };
  assert.throws(() => collectPluginSourceFiles(plugin), refused);
  assert.throws(() => pluginSourceDigest(plugin), refused);
  fs.rmSync(link, { force: true, recursive: false });
  fs.cpSync(shared, link, { recursive: true });
  authored.set("shared/shared.go", "package shared\n");
  const selected = collectPluginSourceFiles(plugin);
  assert.deepEqual(
    selected,
    [...authored.keys()].map((relative) => path.join(plugin, relative)).sort(),
  );
  for (const [relative, bytes] of authored)
    assert.equal(fs.readFileSync(path.join(plugin, relative), "utf8"), bytes);
  assert.match(pluginSourceDigest(plugin), /^[a-f0-9]{64}$/);
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
