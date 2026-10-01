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
 * @evidence contracts/testing.md#execution-ownership This matching named source-unit entry directly executes the authored hashing owner over fixture bytes without a Go executable, native artifact or consumer host; actual build and toolchain probes remain separate boundaries.
 */
export function test_computecachekey_includes_linked_contributor_sources_order_stably() {
  const root = TestProject.tmpdir("ttsc-source-cache-");
  const host = writeGoPackage(root, "host", "main", "const Host = 1\n");
  const left = writeGoPackage(root, "left", "left", "const Value = 1\n");
  const right = writeGoPackage(root, "right", "right", "const Value = 2\n");

  const first = computeCacheKey({
    contributors: [
      { name: "left", source: left },
      { name: "right", source: right },
    ],
    dir: host,
    entry: ".",
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
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  assert.equal(reordered, first);

  fs.writeFileSync(
    path.join(right, "value.go"),
    "package right\nconst Value = 3\n",
    "utf8",
  );
  const changed = computeCacheKey({
    contributors: [
      { name: "left", source: left },
      { name: "right", source: right },
    ],
    dir: host,
    entry: ".",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  assert.notEqual(changed, first);
};

function writeGoPackage(
root: string,
dirName: string,
packageName: string,
body: string,
): string {
const dir = path.join(root, dirName);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "go.mod"),
  `module example.com/${dirName}\n\ngo 1.26\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(dir, "value.go"),
  `package ${packageName}\n${body}`,
  "utf8",
);
return dir;
}
