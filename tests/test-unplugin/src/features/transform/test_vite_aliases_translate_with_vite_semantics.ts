import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createAliasPaths } from "../../../../../packages/unplugin/src/core/transform/alias/createAliasPaths";

/**
 * Verifies each Vite alias is forwarded to `paths` only in the meaning Vite
 * gives its replacement (samchon/ttsc#1399).
 *
 * `alias: { "@": "/src" }` is how many Vite projects spell their source alias,
 * and Vite resolves `/src/x` against its root before the filesystem. The
 * adapter read it as the absolute `/src` (the drive root on Windows), so every
 * `@/...` import failed to resolve, and the overlay then replaced the project's
 * own correct `paths` entry. Relative replacements were resolved against the
 * process directory, although Vite resolves them against each importer.
 *
 * 1. Translate root-relative, absolute, and absolute-below-root replacements, and
 *    assert their targets in Vite's resolution order, and an alias without a
 *    Vite root as itself.
 * 2. Translate relative and bare replacements, and assert each is withheld and
 *    reported once.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createAliasPaths; asserts root-relative ordering, wildcard targets, native/absolute paths, rootless absolute meaning and withholding of relative/bare replacements with one explanatory warning per alias.
 * @evidence contracts/testing.md#independent-expectations Vite root-relative aliases try the project root before the filesystem; relative and package replacements cannot be represented as one project-wide paths mapping. Native path literals follow that documented resolution contract independently of translation.
 * @evidence contracts/testing.md#distinguishing-cases Owns rooted/rootless, inside/outside, slash/native and unsupported relative/bare forms, including repeated warning deduplication. stderr.write is restored in finally; no Vite resolver or native compiler runs.
 * @evidence contracts/testing.md#execution-ownership Unit entry test_vite_aliases_translate_with_vite_semantics is discovered under src/features/transform by TestExecutor. It invokes the owning operations in the test process against controlled fixture inputs; the assertions moved from features and source imports replace built package imports and this entry owns no dynamically registered cases.
 */
export async function test_vite_aliases_translate_with_vite_semantics(): Promise<void> {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-vite-alias-"));
  const slash = (file: string) => file.replace(/\\/g, "/");
  const inside = path.join(root, "src");
  const outside = path.resolve("/vite-alias-shared");

  const translated = createAliasPaths([
    { find: "@", replacement: "/src", root },
    { find: "@inside", replacement: inside, root },
    { find: "@native", replacement: slash(inside), root },
    { find: "~shared", replacement: outside, root },
  ]);
  assert.deepEqual(
    translated["@"],
    [slash(path.join(root, "src")), slash(path.resolve("/src"))],
    "a root-relative replacement tries the root before the filesystem",
  );
  assert.deepEqual(translated["@/*"], [
    `${slash(path.join(root, "src"))}/*`,
    `${slash(path.resolve("/src"))}/*`,
  ]);
  assert.deepEqual(
    translated["@inside"],
    [slash(inside)],
    "an absolute replacement below the root means itself",
  );
  assert.deepEqual(translated["@native"], [slash(inside)]);
  assert.equal(
    translated["~shared"]![translated["~shared"]!.length - 1],
    slash(outside),
    "an absolute replacement keeps its own meaning as the last candidate",
  );
  assert.deepEqual(
    createAliasPaths({ "@rootless": slash(outside) })["@rootless"],
    [slash(outside)],
    "without a Vite root, a POSIX absolute replacement means itself",
  );

  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  process.stderr.write = ((chunk: unknown) => {
    captured += String(chunk);
    return true;
  }) as typeof process.stderr.write;
  let withheld: Record<string, string[]>;
  try {
    const aliases = [
      { find: "@relative-1399", replacement: "./src", root },
      { find: "@bare-1399", replacement: "lodash-es", root },
    ];
    withheld = createAliasPaths(aliases);
    createAliasPaths(aliases);
  } finally {
    process.stderr.write = original;
  }
  assert.deepEqual(withheld, {}, "neither form is forwarded");
  assert.equal(captured.split("@relative-1399").length - 1, 1);
  assert.match(
    captured,
    /relative, which Vite resolves against each importing module/,
  );
  assert.equal(captured.split("@bare-1399").length - 1, 1);
  assert.match(captured, /not a path, which Vite resolves as a package/);
}
