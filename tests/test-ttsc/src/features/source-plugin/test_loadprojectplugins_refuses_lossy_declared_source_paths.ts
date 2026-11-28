import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { validatePluginContributors } from "../../../../../packages/ttsc/src/plugin/internal/load/validatePluginContributors";
import type { ITtscPlugin } from "../../../../../packages/ttsc/src/structures/ITtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source admission cannot change a byte path into a UTF-8 lookalike.
 *
 * 1. Author a Go module with a valid U+FFFD name and admit its contributor.
 * 2. On Linux, expose a distinct raw-name Go module through a readable alias.
 * 3. Require the actual loader and contributor validator to refuse the alias.
 *
 * @evidence contracts/testing.md#behavioral-verification The regular loader evaluates a configured CommonJS descriptor. Source and contributor admission refuse the physical byte path before package lookup or builds can open its lookalike.
 * @evidence contracts/testing.md#independent-expectations Both modules have independently authored native addresses. The alias can read the actual Go source. Literal diagnostics identify the source or contributor declaration that cannot be used.
 * @evidence contracts/testing.md#distinguishing-cases A valid replacement character is accepted. The Linux fixture has a separate raw directory with the same decoded spelling and uses it in both declaration types.
 * @evidence contracts/testing.md#execution-ownership The fixture owns the descriptor, modules, temporary cache and cleanup. The compiled loader starts its real descriptor process with its adjacent packaged preload and stops at source admission, before Go compilation.
 */
export function test_loadprojectplugins_refuses_lossy_declared_source_paths(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-raw-source-")),
  );
  const raw = Buffer.concat([
    Buffer.from(`${root}/source-`),
    Buffer.from([0xff]),
  ]);
  const twin = path.join(root, "source-\ufffd");
  const alias = path.join(root, "source-alias");
  const rawMod = Buffer.concat([raw, Buffer.from("/go.mod")]);
  const rawMain = Buffer.concat([raw, Buffer.from("/main.go")]);
  const module = "module example.com/plugin\n\ngo 1.25\n";
  const source = "package main\n";
  const plugin = (location: string): ITtscPlugin => ({
    name: "raw-source",
    source: twin,
    contributors: [{ name: "contrib", source: location }],
  });
  try {
    fs.mkdirSync(twin);
    fs.writeFileSync(path.join(twin, "go.mod"), module);
    fs.writeFileSync(path.join(twin, "main.go"), source);
    assert.deepEqual(validatePluginContributors(plugin(twin)), [
      { name: "contrib", source: twin },
    ]);
    if (process.platform !== "linux") return;

    fs.mkdirSync(raw);
    fs.writeFileSync(rawMod, module);
    fs.writeFileSync(rawMain, source);
    fs.symlinkSync(raw, alias);
    assert.equal(fs.readFileSync(path.join(alias, "main.go"), "utf8"), source);
    assert.throws(() => validatePluginContributors(plugin(alias)), {
      message: `ttsc: contributor source has no UTF-8 physical path: ${alias}`,
    });

    fs.writeFileSync(
      path.join(root, "descriptor.cjs"),
      `module.exports = ${JSON.stringify({ name: "raw-source", source: alias })};`,
    );
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      tsconfig,
      '{"compilerOptions":{"plugins":[{"transform":"./descriptor.cjs"}]},"files":[]}',
    );
    const require = createRequire(
      path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "package.json"),
    );
    const { loadProjectPlugins } =
      require("./lib/plugin/internal/load/loadProjectPlugins.js") as typeof import("../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins");
    assert.throws(
      () =>
        loadProjectPlugins({
          binary: "",
          cwd: root,
          tsconfig,
          cacheDir: path.join(root, "cache"),
        }),
      {
        message: `ttsc: plugin source has no UTF-8 physical path: ${alias}`,
      },
    );
  } finally {
    if (process.platform === "linux") {
      if (fs.existsSync(alias)) fs.unlinkSync(alias);
      if (fs.existsSync(rawMod)) fs.unlinkSync(rawMod);
      if (fs.existsSync(rawMain)) fs.unlinkSync(rawMain);
      if (fs.existsSync(raw)) fs.rmdirSync(raw);
    }
    fs.rmSync(root, { recursive: true });
  }
}
