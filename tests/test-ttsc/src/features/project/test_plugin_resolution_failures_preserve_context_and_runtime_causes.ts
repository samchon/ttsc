import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginPackageResolution } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginPackageResolution";
import { pluginResolutionFailure } from "../../../../../packages/ttsc/src/plugin/internal/load/pluginResolutionFailure";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies plugin resolution failures retain actionable request context.
 *
 * Runtime errors can expose an empty message or a non-Error object. Plugin and
 * consumer attribution must remain available without guessing the failure.
 *
 * 1. Resolve a missing plugin from a private consumer directory.
 * 2. Require the request, directory, native error code and cause to survive.
 * 3. Contrast empty, structured, primitive and detailed runtime failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes the real resolver for an absent bare package and the production-used diagnostic owner for authored runtime shapes, asserting message attribution, optional detail, original cause identity and unchanged string code.
 * @evidence contracts/testing.md#independent-expectations The supplied request and consumer directory must appear in each diagnostic regardless of runtime text; Node's missing package code is MODULE_NOT_FOUND. Authored cause objects and messages independently specify identity and detail expectations.
 * @evidence contracts/testing.md#distinguishing-cases Exercises actual missing resolution plus Error with detail, empty ResolveMessage-shaped object, structured detail, string cause, null and undefined causes, and nonstring code refusal. It permits absent runtime detail but never an empty attributed message; package target selection and successful native transforms belong to adjacent tests.
 * @evidence contracts/testing.md#execution-ownership The selectable source unit calls the resolver and its diagnostic owner directly with private files and authored values, without replacing resolver methods, spawning a runtime, installing a consumer or building native artifacts; finally removes its temporary directory.
 */
export function test_plugin_resolution_failures_preserve_context_and_runtime_causes(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-plugin-resolution-failure-"),
  );
  const specifier = "absent-plugin/descriptor";
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    assert.throws(
      () => PluginPackageResolution.resolvePluginRequest(specifier, root),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(error.message.includes(JSON.stringify(specifier)));
        assert.ok(error.message.includes(JSON.stringify(root)));
        assert.equal((error as NodeJS.ErrnoException).code, "MODULE_NOT_FOUND");
        assert.ok(error.cause instanceof Error);
        return true;
      },
    );
    const cases: { cause: unknown; detail?: string; code?: string }[] = [
      {
        cause: new Error("native resolution detail"),
        detail: "native resolution detail",
      },
      { cause: { message: "", name: "ResolveMessage" } },
      {
        cause: { message: "structured detail", code: "NATIVE_CODE" },
        detail: "structured detail",
        code: "NATIVE_CODE",
      },
      { cause: "primitive detail", detail: "primitive detail" },
      { cause: null },
      { cause: undefined },
      { cause: { message: "   ", code: 42 } },
    ];
    for (const { cause, detail, code } of cases) {
      const failure = pluginResolutionFailure(specifier, root, cause);
      assert.equal(failure.cause, cause);
      assert.equal((failure as NodeJS.ErrnoException).code, code);
      assert.equal(
        failure.message,
        `ttsc: could not resolve plugin ${JSON.stringify(specifier)} from ${JSON.stringify(root)}${detail === undefined ? "" : `: ${detail}`}`,
      );
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
