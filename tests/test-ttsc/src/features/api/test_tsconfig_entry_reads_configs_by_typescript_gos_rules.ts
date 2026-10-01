import { TestProject } from "../../../../utils/src/TestProject";
import {
  isRelativePluginSpecifier,
  parseJsonc,
  resolveTsconfigExtends,
  tsconfigExtendsFileCandidates,
} from "../../../../../packages/ttsc/src/internal/tsconfig";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the `ttsc/tsconfig` entry reads a config the way TypeScript-Go does:
 * its JSONC grammar and its `extends` rule, `getExtendsConfigPath`.
 *
 * Ttsc's project reader and `@ttsc/unplugin` each carried a copy of these rules
 * (samchon/ttsc#1489). They now share this one, so its cases are pinned here: a
 * separator fold inside the resolver rather than at each caller, the spelling a
 * relatively extended config was reached by (samchon/ttsc#1455), the `.json`
 * fallback, a preset selected through `package.json#tsconfig`, and the exact
 * candidates a missing file-path base would appear under.
 *
 * 1. Parse JSONC with a byte-order mark, both comment forms, and trailing commas.
 * 2. Resolve a backslash specifier, a specifier through a directory link, a
 *    specifier missing its `.json`, and a bare preset package.
 * 3. Assert a missing base throws naming its first candidate, while its candidates
 *    are the file and the file with `.json`, and a module specifier has none.
 * 4. Assert the plugin-path predicate answers relative and bare spellings.
 *
 * @evidence contracts/testing.md#behavioral-verification Parses authored JSONC and resolves real relative, extensionless, linked and package-config fixtures; checks missing candidates and relative versus bare plugin spelling.
 * @evidence contracts/testing.md#independent-expectations Literal parsed data and authored config paths determine expectations; the preset package explicitly declares its tsconfig and missing paths are deliberately absent.
 * @evidence contracts/testing.md#distinguishing-cases BOM/comments/trailing commas, slash variants, extension omission, logical symlink spelling, package entry, missing extension candidates and relative/bare specifiers retain distinct checks.
 * @evidence contracts/testing.md#execution-ownership This named src/features/api function calls authored parsers/resolvers directly on TestProject-owned filesystem fixtures; it installs no consumer, builds no native producer and starts no product host.
 */
export const test_tsconfig_entry_reads_configs_by_typescript_gos_rules =
  (): void => {
    assert.deepEqual(
      parseJsonc(
        '﻿{\n  // line\n  "a": [1, 2,], /* block, */ "b": "//not",\n}\n',
      ),
      { a: [1, 2], b: "//not" },
    );

    const root = TestProject.tmpdir("ttsc-tsconfig-entry-");
    const tsconfig = path.join(root, "tsconfig.json");
    fs.writeFileSync(tsconfig, "{}", "utf8");
    fs.writeFileSync(path.join(root, "base.json"), "{}", "utf8");

    // The fold is the resolver's own: a POSIX `path.resolve` would otherwise
    // name a file called `.\base.json`.
    assert.equal(
      resolveTsconfigExtends(tsconfig, ".\\base.json"),
      path.join(root, "base.json"),
    );
    assert.equal(
      resolveTsconfigExtends(tsconfig, "./base"),
      path.join(root, "base.json"),
    );

    const physical = path.join(root, "physical");
    fs.mkdirSync(physical);
    fs.writeFileSync(path.join(physical, "linked.json"), "{}", "utf8");
    const link = path.join(root, "link");
    fs.symlinkSync(physical, link, "junction");
    assert.equal(
      resolveTsconfigExtends(tsconfig, "./link/linked.json"),
      path.join(link, "linked.json"),
      "a relatively extended config keeps the spelling it was reached by",
    );

    const preset = path.join(root, "node_modules", "preset");
    fs.mkdirSync(path.join(preset, "configs"), { recursive: true });
    fs.writeFileSync(
      path.join(preset, "package.json"),
      JSON.stringify({ name: "preset", tsconfig: "./configs/base.json" }),
      "utf8",
    );
    fs.writeFileSync(path.join(preset, "configs", "base.json"), "{}", "utf8");
    assert.equal(
      resolveTsconfigExtends(tsconfig, "preset"),
      fs.realpathSync(path.join(preset, "configs", "base.json")),
    );

    assert.throws(
      () => resolveTsconfigExtends(tsconfig, "./missing"),
      new RegExp(
        `extended tsconfig not found: ${path.join(root, "missing").replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}$`,
      ),
    );
    assert.deepEqual(tsconfigExtendsFileCandidates(tsconfig, "./missing"), [
      path.join(root, "missing"),
      path.join(root, "missing.json"),
    ]);
    assert.deepEqual(tsconfigExtendsFileCandidates(tsconfig, "./gone.json"), [
      path.join(root, "gone.json"),
    ]);
    assert.equal(tsconfigExtendsFileCandidates(tsconfig, "preset"), undefined);

    for (const relative of ["./plugin", "../plugin", ".\\plugin", ".", ".."])
      assert.equal(isRelativePluginSpecifier(relative), true, relative);
    for (const bare of ["typia/lib/transform", "@scope/plugin", "plugin"])
      assert.equal(isRelativePluginSpecifier(bare), false, bare);
  };
