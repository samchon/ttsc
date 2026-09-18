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
    makeFixtureReadSyntheticEntry(root);
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

/** Make the fixture host honor the synthetic entry config used by ttsx. */
function makeFixtureReadSyntheticEntry(root: string): void {
  const source = path.join(root, "go-plugin", "main.go");
  const original = fs.readFileSync(source, "utf8");
  // The synthetic entry config lists one file and pins `rootDir`; like the
  // compiler, the host writes that file's output mirrored below `rootDir`,
  // which is the only place ttsx looks for a source's output.
  const modified = original
    .replace(
      `_ = fs.String("tsconfig", "", "")`,
      `tsconfig := fs.String("tsconfig", "", "")`,
    )
    .replace(
      `source := filepath.Join(root, "src", "main.ts")`,
      [
        `source := filepath.Join(root, "src", "main.ts")`,
        `  outName := "main.js"`,
        `  if strings.Contains(filepath.Base(*tsconfig), ".ttsx-entry.") {`,
        `    raw, readErr := os.ReadFile(*tsconfig)`,
        `    if readErr != nil {`,
        `      fmt.Fprintln(os.Stderr, readErr)`,
        `      return 2`,
        `    }`,
        `    var config struct {`,
        `      Files           []string`,
        `      CompilerOptions struct{ RootDir string } \`json:"compilerOptions"\``,
        `    }`,
        `    if jsonErr := json.Unmarshal(raw, &config); jsonErr != nil || len(config.Files) != 1 {`,
        `      fmt.Fprintln(os.Stderr, "go-source-plugin: invalid entry config")`,
        `      return 2`,
        `    }`,
        `    source = filepath.FromSlash(config.Files[0])`,
        `    rel, relErr := filepath.Rel(filepath.FromSlash(config.CompilerOptions.RootDir), source)`,
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
