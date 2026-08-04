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
 * "module"` package. The bootstrap has to reach the same answer or it hands
 * that ESM emit to `require`, which fails on the first `export`.
 *
 * Asking from the link's own directory reads the _consuming_ project's package
 * scope instead, which is the one place a symlinked entry's two directories
 * carry different answers.
 *
 * 1. Publish an ESM script in a `"type": "module"` package outside the project.
 * 2. Link to it from a `nodenext` project whose own package declares no type.
 * 3. Run ttsx against the link and assert it loaded as an ES module.
 */
export const test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type =
  () => {
    const root = TestProject.createProject({
      // No `"type"`, so this package scope answers CommonJS.
      "package.json": JSON.stringify({ name: "consumer", version: "1.0.0" }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "nodenext",
          moduleResolution: "nodenext",
          outDir: "lib",
          // Explicit: tsgo raises TS5011 when `outDir` is set and the common
          // source directory would have to be inferred. It also puts the linked
          // entry outside the project's file set, which is the shape under test.
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "src/index.ts": `export const hello = (): string => "world";\n`,
    });
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
      return;
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
  };
