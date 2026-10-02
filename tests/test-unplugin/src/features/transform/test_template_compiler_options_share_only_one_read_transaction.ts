import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readEffectiveTsconfigTemplateCompilerOptions } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigTemplateCompilerOptions";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies template option searches share source reads within one transaction
 * and observe changed configuration in the next transaction.
 *
 * Separate scalar, list and paths selections need the same decoded config
 * sources, while inheritance precedence and declaring anchors stay independent.
 *
 * 1. Read a two-config chain with inherited templates, an own scalar override
 *    and mixed template/ordinary list and alias targets.
 * 2. Assert the literal anchored result and one read of each config source.
 * 3. Change the base config and require a fresh pair of reads and changed output.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual template reader twice; counts reads of both native config sources and checks every materialized scalar, list and alias target, including the leaf override and changed inherited rootDir.
 * @evidence contracts/testing.md#independent-expectations Authored JSON and Node path anchors define all output literals. One source read per config per transaction is the equivalence requirement; the changed base must not reuse a previous transaction's decoded bytes.
 * @evidence contracts/testing.md#distinguishing-cases Own scalar precedence contrasts with inherited options; template targets use the consumer directory while ordinary targets keep the declaring directory. The second call changes source bytes, distinguishing local sharing from stale global caching. Correct output prevents a zero-read implementation from satisfying the count alone.
 * @evidence contracts/testing.md#execution-ownership The source runner calls this synchronous entry over two real temporary configs. A controlled readFileSync wrapper forwards every original operation and counts only those exact config paths; finally restores its original property descriptor. No compiler, Go process or consumer host runs.
 */
export function test_template_compiler_options_share_only_one_read_transaction(): void {
  const baseOptions = {
    rootDir: "${configDir}/src",
    outDir: "${configDir}/base-build",
    typeRoots: ["${configDir}/types", "./vendor"],
    paths: { "@app/*": ["${configDir}/src/*"], ordinary: ["./shared/*"] },
  };
  const root = TestProject.createProject({
    "base.json": JSON.stringify({ compilerOptions: baseOptions }),
    "child/tsconfig.json": '{"extends":"../base.json","compilerOptions":{"outDir":"${configDir}/leaf-build"}}',
  });
  const base = path.join(root, "base.json");
  const leaf = path.join(root, "child", "tsconfig.json");
  const consumer = path.dirname(leaf);
  const slash = (file: string): string => file.split(path.sep).join("/");
  const expected = {
    outDir: path.join(consumer, "leaf-build"),
    rootDir: path.join(consumer, "src"),
    typeRoots: [path.join(consumer, "types"), path.join(root, "vendor")],
    paths: {
      "@app/*": [slash(path.join(consumer, "src", "*"))],
      ordinary: [slash(path.join(root, "shared", "*"))],
    },
  };
  const original = fs.readFileSync;
  const descriptor = Object.getOwnPropertyDescriptor(fs, "readFileSync")!;
  const reads: string[] = [];
  fs.readFileSync = ((...args: unknown[]) => {
    if (args[0] === base || args[0] === leaf) reads.push(args[0] as string);
    return Reflect.apply(original, fs, args);
  }) as typeof fs.readFileSync;
  try {
    assert.deepEqual(readEffectiveTsconfigTemplateCompilerOptions(leaf), expected);
    assert.deepEqual(reads.splice(0).sort(), [base, leaf].sort());
    fs.writeFileSync(base, JSON.stringify({
      compilerOptions: { ...baseOptions, rootDir: "${configDir}/next-src" },
    }));
    assert.deepEqual(readEffectiveTsconfigTemplateCompilerOptions(leaf), {
      ...expected,
      rootDir: path.join(consumer, "next-src"),
    });
    assert.deepEqual(reads.sort(), [base, leaf].sort());
  } finally {
    Object.defineProperty(fs, "readFileSync", descriptor);
  }
}
