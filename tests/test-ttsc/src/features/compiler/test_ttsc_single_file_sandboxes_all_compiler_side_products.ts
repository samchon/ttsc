import {
  assert,
  createProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/toolchain";

/**
 * Verifies positional compilation writes only the launcher's final JS target.
 *
 * Project and CLI output options still affect an ordinary project build, but
 * the private single-file compiler must not leak declarations, build info, or
 * bundles before the launcher copies one transformed JavaScript file.
 */
export const test_ttsc_single_file_sandboxes_all_compiler_side_products =
  (): void => {
    const root = createProject({
      "src/input.ts": "export const input = 1;\n",
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          declaration: true,
          declarationDir: "types",
          incremental: true,
          module: "preserve",
          outFile: "configured-bundle.js",
          rootDir: "src",
          tsBuildInfoFile: "state/configured.tsbuildinfo",
        },
        include: ["src"],
      }),
    });
    const cliBundle = path.join(root, "cli-bundle.js");
    const result = spawn(
      ttscBin,
      ["--cwd", root, "--outFile", cliBundle, "src/input.ts"],
      { cwd: root },
    );

    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.equal(fs.existsSync(path.join(root, "src", "input.js")), true);
    for (const escaped of [
      cliBundle,
      path.join(root, "configured-bundle.js"),
      path.join(root, "types", "input.d.ts"),
      path.join(root, "state", "configured.tsbuildinfo"),
    ]) {
      assert.equal(
        fs.existsSync(escaped),
        false,
        `private compiler leaked ${escaped}\n${result.stdout}${result.stderr}`,
      );
    }
  };
