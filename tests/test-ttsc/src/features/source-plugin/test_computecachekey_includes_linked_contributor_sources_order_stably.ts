import { TestProject } from "../../../../utils/src/TestProject";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies computeCacheKey includes linked contributor sources order-stably.
 *
 * Linked transform packages are compiled into one aggregate native host. The
 * cache key must change when any linked Go source changes, but it must not
 * depend on the descriptor array order when the logical contributor set is the
 * same.
 *
 * 1. Create one host source tree and two linked contributor source trees.
 * 2. Assert reversing contributor declaration order keeps the same cache key.
 * 3. Mutate one contributor source file and assert the cache key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Reversing left/right descriptor declaration order preserves one logical contributor set; replacing only right Value must invalidate it.
 * @evidence contracts/testing.md#independent-expectations Descriptor list order does not change the named contributor set, while a contributor source replacement does change the linked program.
 * @evidence contracts/testing.md#distinguishing-cases Declaring the contributors as left,right and as right,left yields one key, a set rather than a sequence, while changing only the right contributor's constant yields a different key.
 * @evidence contracts/testing.md#execution-ownership A unit test calling computeCacheKey directly on a temp Go module with no goBinary and no go.mod replace directive, so no Go process is spawned and no native build or consumer host is involved.
 */
export function test_computecachekey_includes_linked_contributor_sources_order_stably() {
  const root = TestProject.tmpdir("ttsc-source-cache-");
  const fixture = path.join(TestProject.WORKSPACE_ROOT, "packages", "ttsc", "test", "fixtures", "unit", "computecachekey_includes_linked_contributor_sources_order_stably");
  TestProject.copyDirectory(path.join(fixture, "inputs-1"), root);
  for (const [name, packageName, body] of [["host", "main", "const Host = 1\n"], ["left", "left", "const Value = 1\n"], ["right", "right", "const Value = 2\n"]] as const) {
    const dir = path.join(root, name);
    fs.renameSync(path.join(dir, "value.go.txt"), path.join(dir, "value.go"));
    assert.equal(fs.readFileSync(path.join(dir, "go.mod"), "utf8"), `module example.com/${name}\n\ngo 1.26\n`);
    assert.equal(fs.readFileSync(path.join(dir, "value.go"), "utf8"), `package ${packageName}\n${body}`);
  }
  const host = path.join(root, "host");
  const left = path.join(root, "left");
  const right = path.join(root, "right");

  const first = computeCacheKey({
    contributors: [
      { name: "left", source: left },
      { name: "right", source: right },
    ],
    dir: host,
    entry: ".",
    env: {},
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  const reordered = computeCacheKey({
    contributors: [
      { name: "right", source: right },
      { name: "left", source: left },
    ],
    dir: host,
    entry: ".",
    env: {},
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  assert.equal(reordered, first);

  fs.copyFileSync(path.join(fixture, "inputs-2", "right", "value.go.txt"), path.join(right, "value.go"));
  assert.equal(fs.readFileSync(path.join(right, "value.go"), "utf8"), "package right\nconst Value = 3\n");
  const changed = computeCacheKey({
    contributors: [
      { name: "left", source: left },
      { name: "right", source: right },
    ],
    dir: host,
    entry: ".",
    env: {},
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  assert.notEqual(changed, first);
}
