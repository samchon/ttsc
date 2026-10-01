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
 * @evidence contracts/testing.md#execution-ownership This matching src/features/project entry executes the real boundary described above through the existing TestExecutor population; authored subcases retain their assertion identities.
 * @evidence contracts/e2e.md#necessary-boundary The existing real Go tool parses the authored replace directive through go mod edit -json before physical containment is checked; a surrogate manifest parser cannot prove the product's supported Go grammar/transport connection.
 * @evidence contracts/e2e.md#shared-execution One existing Go mod-edit request and one linked module fixture own the original internal-target exclusion assertion; this case performs no Go build, download or installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject fixtures isolate mutable records and runtime identities. Synchronous child completion or existing session cleanup owns process lifetime; temporary roots remain registered with TestProject for exit cleanup.
 * @evidence contracts/e2e.md#preserved-coverage pluginModuleReplaceDirectories returns no external directory for an internal replacement reached through an alias. Existing inputs and assertions remain in this named entry; no meaningful distinction is removed or transferred by these acknowledgments.
 */
export const test_plugin_module_replace_ignores_an_internal_target_spelled_through_a_link =
  (): void => {
    const root = TestProject.tmpdir("ttsc-internal-replace-link-");
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
