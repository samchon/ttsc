import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { pluginModuleReplaceDirectories } from "../../../../../../packages/ttsc/lib/plugin/internal/source/pluginModuleReplaceDirectories.js";
import { resolveGoCompiler } from "../../../../../../packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js";

/**
 * Verifies a local replacement inside a module stays internal through a link.
 *
 * A module root and its `replace` target can name the same tree through
 * different links, or through Windows' long and 8.3 spellings. Comparing those
 * strings without one physical resolver reports an internal target as a second
 * external plugin source and watches and keys it twice.
 *
 * 1. Create a Go module and link another path to that module.
 * 2. Name one of its own directories through the link in `go.mod`.
 * 3. Assert no external replacement directory is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification pluginModuleReplaceDirectories returns no external directory for an internal replacement reached through an alias.
 * @evidence contracts/testing.md#independent-expectations The authored replacement resolves inside the same real module, so lexical alias differences cannot create an external source.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create a Go module and link another path to that module. 2. Name one of its own directories through the link in `go.mod`. 3. Assert no external replacement directory is reported.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner directly calls the built owning reader with the actual configured Go tool and native directory alias. Go mod-edit JSON is product grammar transport, not an independent language oracle or a plugin build/installed consumer.
 * @evidence contracts/e2e.md#necessary-boundary The existing real Go tool parses the authored replace directive through go mod edit -json before physical containment is checked; a surrogate manifest parser cannot prove the product's supported Go grammar/transport connection.
 * @evidence contracts/e2e.md#shared-execution One logical mod-edit request and native linked module fixture own the internal-target exclusion. The body requests no Go build or consumer installation; selected-tool preparation, environment/capture and fallback attempts are separate observed populations, not one certified process or zero download cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before native link/go.mod preparation. Tool selection/default env remain actual caller authorities; no ambient mutation occurs. Synchronous command result does not establish arbitrary descendant join or immutable executable ownership.
 * @evidence contracts/e2e.md#preserved-coverage pluginModuleReplaceDirectories returns no external directory for an internal replacement reached through an alias. Original junction/directory link, linked internal replace path and exact empty-array expectation remain; no Windows short-alias input is added or certified. Runtime/manifest/survival unverified and donor retained.
 */
export const test_plugin_module_replace_ignores_an_internal_target_spelled_through_a_link =
  (): void => {
    const root = TestProject.tmpdir("ttsc-internal-replace-link-");
    TestProject.retainTemporaryDirectory(root, "Go directive reader descendants are not joined");
    const module = path.join(root, "module");
    const linked = path.join(root, "linked-module");
    const internal = path.join(module, "internal");
    fs.mkdirSync(internal, { recursive: true });
    fs.symlinkSync(module, linked, "junction");
    fs.writeFileSync(
      path.join(module, "go.mod"),
      [
        "module example.com/plugin",
        "",
        "go 1.26",
        "",
        "require example.com/internal v0.0.0",
        "",
        `replace example.com/internal => ${path
          .join(linked, "internal")
          .split(path.sep)
          .join("/")}`,
        "",
      ].join("\n"),
      "utf8",
    );
    const go = resolveGoCompiler().binary;

    assert.deepEqual(
      pluginModuleReplaceDirectories(
        module,
        { ...process.env, TTSC_GO_BINARY: go },
        go,
      ),
      [],
    );
  };
