package banner_test

import (
  "path/filepath"
  "testing"
)

// TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment verifies the whole
// loader — not just the two resolvers — runs with neither tool variable set.
//
// The resolvers can both be right while the loader still spawns a bare `ttsx`
// or omits `--binary`, because the anchors are built inside
// loadBannerTypeScriptConfigFile and handed on from there. This is the issue's
// positive case at the level a unit suite can reach: the launcher is the one
// the project installed (nothing else could have run), and the compiler is the
// project's, which the launcher reports back through the payload channel
// because that is the only channel this loader reads. The fake launcher exits
// non-zero when `--binary` is missing, so an unresolved compiler fails here
// rather than passing with an empty report.
//
//  1. Install a `ttsc` whose launcher echoes its own `--binary` argument, and a
//     resolvable `typescript` beside it.
//  2. Shed TTSC_TSGO_BINARY and TTSC_TTSX_BINARY, then load a
//     `banner.config.ts`.
//  3. Assert the loaded value carries the project's own compiler path.
func TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := bannerRealpathIfPossible(t.TempDir())
  compiler := seedProjectTypeScript(t, root)
  launcher := seedProjectTtscWithoutLauncher(t, root)
  writeFile(t, launcher, `const args = process.argv.slice(2);
const index = args.indexOf("--binary");
if (index < 0 || index + 1 >= args.length) {
  process.stderr.write("the loader spawned this launcher without --binary\n");
  process.exit(3);
}
process.stdout.write(JSON.stringify({ complete: true, inputs: [], hashes: {}, realpaths: {}, value: { text: args[index + 1] } }));
`)

  config := filepath.Join(root, "banner.config.ts")
  writeFile(t, config, "export default { text: \"never read, the launcher is fake\" };\n")

  raw, err := bannerLoadBannerTypeScriptConfigFile(config, root)
  if err != nil {
    t.Fatalf("TypeScript config load failed with no tool variables set: %v", err)
  }
  object, ok := raw.(map[string]any)
  if !ok {
    t.Fatalf("loaded value is not an object: %#v", raw)
  }
  if object["text"] != compiler {
    t.Fatalf("loader passed --binary %#v, want the project compiler %q", object["text"], compiler)
  }
}
