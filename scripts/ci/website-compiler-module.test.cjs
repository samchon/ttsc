const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const WEBSITE_COMPILER = path.join(ROOT, "website", "compiler");
const SHIM_PREFIX = "github.com/microsoft/typescript-go/shim/";

/**
 * Read a module with Go's own parser so the regression follows go.mod syntax
 * instead of maintaining a second, partial parser in JavaScript.
 */
function readGoMod(directory) {
  const result = cp.spawnSync("go", ["mod", "edit", "-json"], {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  assert.equal(
    result.status,
    0,
    `go mod edit failed in ${directory}:\n${result.stderr}`,
  );
  return JSON.parse(result.stdout);
}

function locallyReplacedRequiredShims(directory) {
  const mod = readGoMod(directory);
  const replacements = new Map(
    (mod.Replace ?? [])
      .filter(
        (entry) =>
          entry.Old.Path.startsWith(SHIM_PREFIX) &&
          entry.New.Version === undefined,
      )
      .map((entry) => [
        entry.Old.Path,
        path.resolve(directory, entry.New.Path),
      ]),
  );
  return (mod.Require ?? [])
    .map((entry) => entry.Path)
    .filter((modulePath) => replacements.has(modulePath))
    .map((modulePath) => [modulePath, replacements.get(modulePath)]);
}

test("website compiler mirrors every in-tree shim its local modules require", () => {
  const required = new Map();
  for (const directory of [
    path.join(ROOT, "packages", "ttsc"),
    path.join(ROOT, "packages", "wasm"),
  ]) {
    for (const [modulePath, target] of locallyReplacedRequiredShims(
      directory,
    )) {
      const previous = required.get(modulePath);
      assert.ok(
        previous === undefined || previous === target,
        `${modulePath} has conflicting local replacements`,
      );
      required.set(modulePath, target);
    }
  }
  const website = readGoMod(WEBSITE_COMPILER);
  const websiteRequires = new Set(
    (website.Require ?? []).map((entry) => entry.Path),
  );
  const websiteReplaces = new Map(
    (website.Replace ?? []).map((entry) => [entry.Old.Path, entry.New]),
  );

  for (const [modulePath, expectedTarget] of [...required.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    assert.ok(
      websiteRequires.has(modulePath),
      `website/compiler/go.mod must require ${modulePath}`,
    );
    const replacement = websiteReplaces.get(modulePath);
    assert.ok(
      replacement,
      `website/compiler/go.mod must replace ${modulePath}`,
    );
    assert.equal(
      replacement.Version,
      undefined,
      `${modulePath} must use an in-tree replacement`,
    );

    const target = path.resolve(WEBSITE_COMPILER, replacement.Path);
    assert.equal(
      target,
      expectedTarget,
      `${modulePath} must mirror its local source replacement`,
    );
    assert.ok(
      fs.existsSync(path.join(target, "go.mod")),
      `${modulePath} replacement has no go.mod at ${target}`,
    );
    assert.equal(
      readGoMod(target).Module.Path,
      modulePath,
      `${modulePath} replacement points at a different module`,
    );
  }
});
