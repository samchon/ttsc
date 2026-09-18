import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { startMembershipSession } from "../../internal/transform-program-membership/startMembershipSession";

/**
 * Verifies the files the compiler reads that are not sources are still proven
 * after the walk stopped hashing them.
 *
 * The walk now collects only files that could enter the program, which is what
 * keeps a tree of emitted output from costing a read per file. That is safe
 * only because the compiler's own non-source inputs are proven somewhere else:
 * the tsconfig, the package manifest and the plugin descriptor are universal
 * host inputs, validated by identity and content on every delivery rather than
 * by the project walk. If that were not so, narrowing the walk would have
 * silently stopped a tsconfig edit from invalidating anything, which is the
 * worst outcome this cycle could have produced (samchon/ttsc#1307).
 *
 * Each edit is its own pass, and each must cost exactly one compile.
 */
export async function test_transformttsc_non_source_host_inputs_are_still_proven(): Promise<void> {
  const session = await startMembershipSession({ fileCount: 2 });
  try {
    await session.pass();
    assert.equal(session.compiles(), 1);
    await session.pass();
    assert.equal(session.compiles(), 1, "an unchanged project costs nothing");

    const tsconfig = path.join(session.root, "tsconfig.json");
    const parsed = JSON.parse(fs.readFileSync(tsconfig, "utf8")) as {
      compilerOptions: Record<string, unknown>;
    };
    parsed.compilerOptions.target = "ES2021";
    fs.writeFileSync(tsconfig, JSON.stringify(parsed, null, 2), "utf8");
    await session.pass();
    assert.equal(
      session.compiles(),
      2,
      "a tsconfig edit must still replace the generation",
    );

    fs.writeFileSync(
      path.join(session.root, "package.json"),
      JSON.stringify({ private: true, type: "commonjs", version: "9.9.9" }),
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      3,
      "a package manifest edit must still replace the generation",
    );

    const descriptor = path.join(session.root, "plugin.cjs");
    fs.writeFileSync(
      descriptor,
      `${fs.readFileSync(descriptor, "utf8")}\n// touched\n`,
      "utf8",
    );
    await session.pass();
    assert.equal(
      session.compiles(),
      4,
      "a plugin descriptor edit must still replace the generation",
    );
  } finally {
    session.close();
  }
}
