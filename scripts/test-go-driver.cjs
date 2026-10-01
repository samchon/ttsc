// Run the Go unit tests for the ttsc driver packages.
//
// The package-local tests exercise internal observation invariants, while the
// external driver tests exercise the public emit and plugin-transform API.
// Both own regressions that do not pass through utility plugin packages.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
const DRIVER_TEST_PACKAGES = ["./driver", "./test/driver"];
if (require.main === module) {
  // In-process compiler profiles have their own physical package. They do not
  // launch the product and are not repeated by the native proxy/race batch.
  const packages = process.env.TTSC_TEST_LAYER === "unit"
    ? ["./test/driver-unit"]
    : [...DRIVER_TEST_PACKAGES, "./test/driver-unit"];
  const result = cp.spawnSync(
    "go",
    ["test", "-json", "-trimpath", "-count=1", ...packages],
    {
      cwd: path.join(root, "packages", "ttsc"),
      env: {
        ...process.env,
        PATH: fs.existsSync(goRoot)
          ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
          : process.env.PATH,
      },
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );

  if (result.error) {
    throw result.error;
  }
  process.stderr.write(result.stderr ?? "");
  // Echo ordinary Go output while keeping emitted JS payloads in memory.
  let ordinaryOutput = "";
  for (const line of (result.stdout ?? "").trimEnd().split(/\r?\n/)) {
    try {
      const event = JSON.parse(line);
      if (event.Action === "output") ordinaryOutput += event.Output;
    } catch { /* The strict unit decoder reports malformed transport. */ }
  }
  for (const line of ordinaryOutput.split(/\r?\n/)) {
    if (line && !line.startsWith("TTSC_RUNTIME_EMIT_V1:") && !line.startsWith("TTSC_JSX_EMIT_V1:")) console.log(line);
  }
  for (const [file, name] of [
    ["test_runtime_compiler_output_preserves_decorator_effects", "test_runtime_compiler_output_preserves_decorator_effects"],
    ["test_runtime_compiler_output_renders_jsx_profiles", "test_runtime_compiler_output_renders_jsx_profiles"],
  ]) {
    try { require("../tests/test-ttsc/src/features/runtime/" + file + ".cjs")[name](result); }
    catch (error) { console.error(error); process.exitCode = 1; }
  }
  process.exitCode = process.exitCode || result.status || 0;
}

module.exports = { DRIVER_TEST_PACKAGES };
