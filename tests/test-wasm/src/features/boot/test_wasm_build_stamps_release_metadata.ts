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
 */
export const test_wasm_build_stamps_release_metadata = (): void => {
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
      ldflags.includes(`-X ${build.hostPackage}.${field}=`),
      true,
    );

  const again = build.buildStamp();
  TestValidator.equals(
    "the stamp repeats, so the build cache can hit",
    again,
    stamp,
  );
};
