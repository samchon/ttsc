package banner_test

import (
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/banner/test/internal/shared"
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
//
// @evidence contracts/testing.md#behavioral-verification The banner TypeScript loader resolves project fixtures without tool variables, starts the fixture launcher and returns its report of the exact --binary compiler path.
// @evidence contracts/testing.md#independent-expectations The fake launcher rejects missing --binary and echoes the next argument; the expected path is independently authored project layout.
// @evidence contracts/testing.md#distinguishing-cases The compiler is an empty fixture file and the launcher only reports argv. Config source is never evaluated, so this distinguishes argument transport rather than real TypeScript compilation.
// @evidence contracts/testing.md#execution-ownership The named entry directly calls the banner loader and starts actual Node with a fake project launcher. It is a process protocol test, not real compiler installation.
func TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment(t *testing.T) {
  shared.ShedConfigToolEnvironment(t)
  root := shared.BannerRealpathIfPossible(t.TempDir())
  compiler := shared.SeedProjectTypeScript(t, root)
  launcher := shared.SeedProjectTtscWithoutLauncher(t, root)
  shared.WriteFile(t, launcher, `const args = process.argv.slice(2);
const index = args.indexOf("--binary");
if (index < 0 || index + 1 >= args.length) {
  process.stderr.write("the loader spawned this launcher without --binary\n");
  process.exit(3);
}
process.stdout.write(JSON.stringify({ complete: true, inputs: [], hashes: {}, realpaths: {}, value: { text: args[index + 1] } }));
`)

  config := filepath.Join(root, "banner.config.ts")
  shared.WriteFile(t, config, "export default { text: \"never read, the launcher is fake\" };\n")

  raw, err := shared.BannerLoadBannerTypeScriptConfigFile(config, root)
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
