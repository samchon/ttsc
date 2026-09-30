import { TestValidator } from "@nestia/e2e";
import { createRequire } from "node:module";
import path from "node:path";

const require_ = createRequire(import.meta.url);

/**
 * Verifies the wasm build asks the linker to stamp real release metadata.
 *
 * `api.version()` exists to identify which wasm is running, and every published
 * binary answered with the compile-time defaults — `0.0.0-dev` / `dev` /
 * `unknown` — because the build never passed the `-X` flags the package's own
 * README documents. The guide tells consumers to copy the base artifact
 * verbatim, so that unstamped binary is the one almost everyone deploys, and
 * the bug reports the documentation asks for carried no usable identity.
 *
 * The date is the commit's, not the build's: this build is content-cached, so a
 * value that changed every run would be a build flag that never repeats and the
 * cache could never hit. Asserting stability across two calls is what pins that
 * choice.
 *
 * 1. Load the build script as a module and read the stamp it composes.
 * 2. Assert none of the three fields is still the compile-time default and that
 *    each `-X` flag names the host package.
 * 3. Assert a second read produces the same values, so the flags are cacheable.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual build script reads the package version and Git HEAD facts, supplies all three linker assignment flags for the WASM host, and returns the same metadata twice within an unchanged checkout.
 * @evidence contracts/testing.md#independent-expectations The known host package identity and three metadata field names are literal expectations; default sentinel rejection and equality across two actual reads establish populated reproducible inputs rather than deriving the expected host from the build export.
 * @evidence contracts/testing.md#distinguishing-cases Version, commit and date are checked separately, as are their linker assignments; the second metadata read detects build-time dates that change under an immutable HEAD. This does not inspect a linked WASM artifact or prove its runtime version bridge.
 * @evidence contracts/testing.md#execution-ownership This named feature entry requires the authored CommonJS build module without calling main or go build and executes its actual manifest and Git adapters; no runtime method or foreign global is replaced.
 * @evidence contracts/e2e.md#necessary-boundary The build script must read real checkout Git identity and package metadata into its actual linker arguments. The adapter crosses Git subprocess and native manifest boundaries; a pure input-composition unit alone cannot detect broken Git arguments or checkout anchoring.
 * @evidence contracts/e2e.md#shared-execution One loaded build module supplies the linker arguments and both metadata observations in the same Node lifetime; no WASM compiler, per-case native build, installation or runtime boot is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Git and package reads are read-only and assume the CI checkout HEAD and manifest remain immutable during the entry. The require cache shares the module's argument snapshot; the test clears no build cache and creates no retained fixture or child session.
 * @evidence contracts/e2e.md#preserved-coverage All original sentinel, linker-field and repeated-stamp assertions remain, with the host package oracle made independent. Actual linker output and runtime boot were never established by this case and are not claimed as preserved proof.
 */
export function test_wasm_build_stamps_release_metadata(): void {
  const build = require_(
    path.join(
      process.cwd(),
      "..",
      "..",
      "packages",
      "wasm",
      "build",
      "build-wasm.cjs",
    ),
  ) as {
    buildArguments: string[];
    buildStamp: () => { version: string; commit: string; date: string };
    hostPackage: string;
  };

  const stamp = build.buildStamp();
  TestValidator.equals(
    "version is stamped",
    stamp.version !== "0.0.0-dev",
    true,
  );
  TestValidator.equals("commit is stamped", stamp.commit !== "dev", true);
  TestValidator.equals("date is stamped", stamp.date !== "unknown", true);

  const ldflags = build.buildArguments.join(" ");
  for (const field of ["version", "commit", "date"])
    TestValidator.equals(
      `-X names ${field}`,
      ldflags.includes(
        `-X github.com/samchon/ttsc/packages/wasm/host.${field}=`,
      ),
      true,
    );

  const again = build.buildStamp();
  TestValidator.equals(
    "the stamp repeats, so the build cache can hit",
    again,
    stamp,
  );
}
