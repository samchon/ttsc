package strip_test

import (
  "path/filepath"
  "testing"
)

// TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment verifies the whole
// loader — not just the two resolvers — runs with neither tool variable set.
//
// The resolvers can both be right while the loader still spawns a bare `ttsx`
// or omits `--binary`, because the anchors are built inside
// loadStripTypeScriptConfigFile and handed on from there. This is the issue's
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
//     `strip.config.ts`.
//  3. Assert the loaded value carries the project's own compiler path.
// @evidence contracts/testing.md#behavioral-verification The strip TypeScript loader resolves project fixtures without tool variables, starts the fixture launcher and returns its report of the exact --binary compiler path.
// @evidence contracts/testing.md#independent-expectations The fake launcher rejects missing --binary and echoes the next argument; the expected path is independently authored project layout.
// @evidence contracts/testing.md#distinguishing-cases The compiler is an empty fixture file and the launcher only reports argv. Config source is never evaluated, so this distinguishes argument transport rather than real TypeScript compilation.
// @evidence contracts/testing.md#execution-ownership The named entry directly calls the strip loader and starts actual Node with a fake project launcher. It is a process protocol test, not real compiler installation.
// @evidence contracts/e2e.md#necessary-boundary The loader-to-project-launcher argv and payload connection is observed. The evaluates filename does not establish execution of config source; a real compiler/ttsx owner is separately required.
// @evidence contracts/e2e.md#shared-execution One fixture launcher invocation observes arguments. No Go producer or compiler build occurs; the compiler-shaped file is only transported.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.Setenv restores tool variables, t.TempDir owns install fixtures and the loader removes its temporary directory. Cached output cannot replace this argument observation.
// @evidence contracts/e2e.md#preserved-coverage The original success and exact compiler-path assertion remain. This case alone leaves actual TypeScript export evaluation unverified.
func TestTypeScriptConfigEvaluatesWithoutTheToolEnvironment(t *testing.T) {
  shedConfigToolEnvironment(t)
  root := stripRealpathIfPossible(t.TempDir())
  compiler := seedProjectTypeScript(t, root)
  launcher := seedProjectTtscWithoutLauncher(t, root)
  writeFile(t, launcher, `const args = process.argv.slice(2);
const index = args.indexOf("--binary");
if (index < 0 || index + 1 >= args.length) {
  process.stderr.write("the loader spawned this launcher without --binary\n");
  process.exit(3);
}
process.stdout.write(JSON.stringify({ complete: true, inputs: [], hashes: {}, realpaths: {}, value: { binary: args[index + 1] } }));
`)

  config := filepath.Join(root, "strip.config.ts")
  writeFile(t, config, "export default {};\n")

  raw, err := stripLoadStripConfigFile(config, root)
  if err != nil {
    t.Fatalf("TypeScript config load failed with no tool variables set: %v", err)
  }
  object, ok := raw.(map[string]any)
  if !ok {
    t.Fatalf("loaded value is not an object: %#v", raw)
  }
  // `binary` is the fake launcher's report of what it was handed, not a strip
  // configuration key: what is under test is which tools the loader resolved.
  if object["binary"] != compiler {
    t.Fatalf("loader passed --binary %#v, want the project compiler %q", object["binary"], compiler)
  }
}
