import { FixtureFiles } from "../../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies a symlinked entry's module format comes from the package that
 * actually holds it, not from the package the link sits in.
 *
 * Under the `node*` module family the format is decided by the nearest
 * `package.json` `"type"`, and the compiler decides it from the file it is
 * handed — the physical path — so it emits ESM for a target inside a `"type":
 * "module"` package. The runtime has to reach the same answer or it hands that
 * ESM emit to `require`, which fails on the first `export`.
 *
 * Asking from the link's own directory reads the _consuming_ project's package
 * scope instead, which is the one place a symlinked entry's two directories
 * carry different answers.
 *
 * 1. Publish an ESM script in a `"type": "module"` package outside the project.
 * 2. Link to it from a `nodenext` project whose own package declares no type.
 * 3. Run ttsx against the link and assert it loaded as an ES module.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx follows a file symlink from a CommonJS package to an external ESM package; status zero, loaded-as-esm output and absence of syntax-loader errors require the physical target format.
 * @evidence contracts/testing.md#independent-expectations The fixture gives the source target type module and the link owner no type; authored export syntax and marker must execute as ESM independently of package lookup internals.
 * @evidence contracts/testing.md#distinguishing-cases Contrary lexical and physical package types distinguish target-based classification; the unchanged early return means hosts lacking file-symlink permission do not execute this boundary.
 * Unavailable host capabilities return false so the runner reports SKIPPED without claiming this case executed its behavioral assertions.
 *
 * @evidence contracts/testing.md#execution-ownership This named feature entry owns one public launcher and an external fixture source tree linked by a native file symlink; no test function is dynamically hidden inside that source.
 * @evidence contracts/e2e.md#necessary-boundary Native link resolution must select the same source package for compiler emit and Node host labeling; record-only classifier calls cannot establish this real filesystem-to-loader connection.
 * @evidence contracts/e2e.md#shared-execution One immutable linked entry and one launcher host suffice; its contrary external package identity prevents replacing it with the ordinary same-directory ESM consumer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the consumer and external target trees; only the fixture file is linked, synchronous execution ends before tracked cleanup, and the account capability limitation is explicit.
 * @evidence contracts/e2e.md#preserved-coverage Zero status, marker output and both negative syntax-error patterns remain; actual link divergence is not claimed on hosts that cannot create the original symlink.
 */
export function test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type(): void | false {
    const root = TestProject.createProject(FixtureFiles.read("ttsc/ttsx_classifies_a_symlinked_entry_from_the_target_package_type/inputs-1"));
    const outside = TestProject.tmpdir("ttsc-esm-package-");
    fs.writeFileSync(
      path.join(outside, "package.json"),
      JSON.stringify({ name: "esm-tools", type: "module", version: "1.0.0" }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(outside, "tool.ts"),
      [
        // An `export` is what makes the emit ESM syntax rather than merely ESM
        // by declaration, so loading it through `require` cannot silently work.
        `export const marker: string = "loaded-as-esm";`,
        `console.log(marker);`,
        "",
      ].join("\n"),
      "utf8",
    );

    try {
      fs.symlinkSync(
        path.join(outside, "tool.ts"),
        path.join(root, "tool.ts"),
        "file",
      );
    } catch {
      // Without symlink permission the link and its target share a directory,
      // and the contract this pins cannot be exercised.
      return false;
    }
    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "tool.ts"],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /loaded-as-esm/);
    assert.doesNotMatch(
      result.stderr,
      /Unexpected token 'export'|Cannot use import statement/,
      "the entry was classified from the link's package scope, not the target's",
    );
  }
