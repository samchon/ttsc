import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
} from "../../internal/plugin-corpus";
import {
  MOCHA_BIN,
  TTSX_REGISTER,
  linkTtscPackage,
} from "../../internal/ttsx-register";

/**
 * Verifies plugin corpus: ttsx register executes source plugin output.
 *
 * Plain TypeScript execution cannot prove the preload reused ttsx's compiler
 * preparation. This fixture's Go-source transform rewrites the runtime value,
 * while real Mocha loads that root from outside the project's `include`, so its
 * output pins the complete fallback, plugin build, and transformed-emit path.
 *
 * 1. Copy the native Go-source plugin fixture and add an excluded entry root.
 * 2. Load it through real Mocha with `--require ttsc/register`.
 * 3. Assert the transformed uppercase value is the code that executes.
 */
export const test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end =
  () => {
    const root = copyProject("go-source-plugin");
    linkTtscPackage(root);
    const testDir = path.join(root, "test");
    fs.mkdirSync(testDir);
    fs.writeFileSync(
      path.join(testDir, "main.ts"),
      [
        `export const value: string = goUpper("plugin");`,
        `console.log(value);`,
        "",
      ].join("\n"),
      "utf8",
    );
    makeFixtureReadPublishedRoot(root);
    const result = spawn(
      process.execPath,
      [
        MOCHA_BIN,
        "--require",
        TTSX_REGISTER,
        "--extension",
        "ts",
        "test/main.ts",
      ],
      {
        cwd: root,
        env: {
          PATH: goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^PLUGIN$/m);
  };

/**
 * Make the fixture host honor the root files ttsx publishes.
 *
 * The fixture reads its source itself instead of building a Program through
 * `driver.LoadProgram`, so it takes the root the way any such host must: from
 * `TTSC_ROOT_FILES`, with the `rootDir` ttsx forwards in `TTSC_TSGO_ARGS`. Like
 * the compiler, it writes that file's output mirrored below `rootDir`, which is
 * the only place ttsx looks for a source's output.
 */
function makeFixtureReadPublishedRoot(root: string): void {
  const source = path.join(root, "go-plugin", "main.go");
  const original = fs.readFileSync(source, "utf8");
  const modified = original
    .replace(
      `source := filepath.Join(root, "src", "main.ts")`,
      [
        `source := filepath.Join(root, "src", "main.ts")`,
        `  outName := "main.js"`,
        `  if rawRoots := os.Getenv("TTSC_ROOT_FILES"); rawRoots != "" {`,
        `    var roots []string`,
        `    if jsonErr := json.Unmarshal([]byte(rawRoots), &roots); jsonErr != nil || len(roots) != 1 {`,
        `      fmt.Fprintln(os.Stderr, "go-source-plugin: invalid TTSC_ROOT_FILES")`,
        `      return 2`,
        `    }`,
        `    var forwarded []string`,
        `    if jsonErr := json.Unmarshal([]byte(os.Getenv("TTSC_TSGO_ARGS")), &forwarded); jsonErr != nil {`,
        `      fmt.Fprintln(os.Stderr, "go-source-plugin: invalid TTSC_TSGO_ARGS")`,
        `      return 2`,
        `    }`,
        `    rootDir := ""`,
        `    for i := 0; i+1 < len(forwarded); i++ {`,
        `      if strings.EqualFold(forwarded[i], "--rootDir") {`,
        `        rootDir = forwarded[i+1]`,
        `      }`,
        `    }`,
        `    source = filepath.FromSlash(roots[0])`,
        `    rel, relErr := filepath.Rel(filepath.FromSlash(rootDir), source)`,
        `    if relErr != nil {`,
        `      fmt.Fprintln(os.Stderr, relErr)`,
        `      return 2`,
        `    }`,
        `    outName = strings.TrimSuffix(rel, filepath.Ext(rel)) + ".js"`,
        `  }`,
      ].join("\n"),
    )
    .replace(
      `out := filepath.Join(root, *outDir, "main.js")`,
      `out := filepath.Join(root, *outDir, outName)`,
    )
    .replace(
      `out = filepath.Join(*outDir, "main.js")`,
      `out = filepath.Join(*outDir, outName)`,
    );
  assert.notEqual(modified, original);
  fs.writeFileSync(source, modified, "utf8");
}
