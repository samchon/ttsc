import {
  assert,
  commonJsProject,
  fs,
  path,
  spawn,
  ttscBin,
} from "../../internal/compiler-corpus";

const project = {
  name: "clean removes local source plugin cache directories",
  root: () =>
    commonJsProject({
      "src/main.ts": `export const value = "clean";\n`,
    }),
  run(root: string) {
    const override = path.join(root, "override-cache");
    for (const target of [
      path.join(root, "node_modules", ".ttsc", "plugins", "a"),
      path.join(root, ".ttsc", "plugins", "b"),
      path.join(override, "plugins", "c"),
    ]) {
      fs.mkdirSync(target, { recursive: true });
      fs.writeFileSync(path.join(target, "plugin"), "binary", "utf8");
    }

    const result = spawn(ttscBin, ["clean", "--cwd", root], {
      cwd: root,
      env: { TTSC_CACHE_DIR: override },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /removed node_modules[/\\]\.ttsc/);
    assert.match(result.stdout, /removed \.ttsc/);
    assert.equal(
      fs.existsSync(path.join(root, "node_modules", ".ttsc")),
      false,
    );
    assert.equal(fs.existsSync(path.join(root, ".ttsc")), false);
    assert.equal(fs.existsSync(path.join(override, "plugins")), false);
  },
};

/**
 * Verifies compiler corpus: clean removes local source plugin cache
 * directories.
 *
 * This ttsc compiler corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_compiler_corpus_clean_removes_local_source_plugin_cache_directories =
  (): void => {
    const root = project.root();
    project.run(root);
  };
