import assert from "node:assert/strict";
import path from "node:path";

import unpluginBun from "../../../../../packages/unplugin/src/bun";
import { TestProject } from "../../../../utils/src/TestProject";
import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun build files remain owned by Bun's in-memory loader.
 *
 * `BuildConfig.files` can introduce a path with no disk entry or override an
 * existing one. Reading either through the filesystem violates Bun's stated
 * priority and can produce an `ENOENT` or transform stale disk contents.
 * Ownership has to follow Bun's own path equivalence, neither wider (a
 * differently cased key must not suppress a disk transform) nor narrower
 * (Windows drive-letter case and separators must not escape it).
 *
 * 1. Capture the bundler loader with relative and absolute `files` entries.
 * 2. Assert both are left to Bun, across separator and working-directory changes.
 * 3. Assert differently cased, relative, and dot-segment keys do not claim a disk
 *    path, while Windows-equivalent spellings stay owned by Bun.
 *
 * @evidence contracts/testing.md#behavioral-verification Captured loaders leave virtual and relative files to Bun, but resolve disk options for differing case and spelling; Windows-equivalent drive/separator spellings bypass disk transform.
 * @evidence contracts/testing.md#independent-expectations Configured in-memory ownership forbids reading absent virtual paths; option counters expose entry into disk transformation.
 * @evidence contracts/testing.md#distinguishing-cases Relative/absolute keys, cwd changes, case difference, dot segments and conditional Windows equivalence.
 * @evidence contracts/testing.md#execution-ownership The unit runner calls the authored source Bun factory through supported setup/onLoad collaborators and literal temporary files. Plugin options are empty for every disk load, so no native producer, built entry or Bun host runs. Real registration and ambient ownership remain in test_bun_native_host_owns_build_and_runtime_sessions.
 */
export async function test_bun_adapter_yields_to_configured_in_memory_files(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-bun-memory-unit-");
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"compilerOptions":{"plugins":[]},"include":["src"]}',
    "src/main.ts":
      'export const value: string = goUpper("plugin");\nconsole.log(value);\n',
  });
  const main = path.join(root, "src", "main.ts");
  const relativeMain = path.join("src", path.basename(main));
  const reportedRelativeMain = relativeMain.split(path.sep).join("/");
  const virtual = path.resolve(root, "virtual.ts");
  const { loader } = await captureBunLoader(unpluginBun(), "bundler", {
    files: {
      [relativeMain]: "export const memory = true;",
      [virtual]: "export const virtual = true;",
    },
    root,
  });

  const setupDirectory = process.cwd();
  try {
    process.chdir(root);
    assert.equal(
      await loader({ path: reportedRelativeMain }),
      undefined,
      "relative ownership must survive separator and cwd changes",
    );
    assert.equal(
      await loader({ path: virtual }),
      undefined,
      "an absolute files entry must not be read from the filesystem",
    );
  } finally {
    process.chdir(setupDirectory);
  }

  const caseVariant = main.replace(/(^|[\\/])src([\\/])/, "$1SRC$2");
  assert.notEqual(caseVariant, main);
  let optionResolutions = 0;
  const { loader: caseSensitiveLoader } = await captureBunLoader(
    unpluginBun(() => {
      ++optionResolutions;
      return { plugins: [] };
    }),
    "bundler",
    {
      files: {
        [caseVariant]: "export const differentlyCased = true;",
      },
    },
  );
  await caseSensitiveLoader({ path: main });
  assert.equal(
    optionResolutions,
    1,
    "a differently cased files key must not suppress a disk transform",
  );

  const dotAbsoluteMain = `${path.dirname(main)}${path.sep}..${path.sep}src${path.sep}${path.basename(main)}`;
  let spellingOptionResolutions = 0;
  const { loader: spellingLoader } = await captureBunLoader(
    unpluginBun(() => {
      ++spellingOptionResolutions;
      return { plugins: [] };
    }),
    "bundler",
    {
      files: {
        [dotAbsoluteMain]: "export const dotSpelling = true;",
        [relativeMain]: "export const relativeSpelling = true;",
      },
    },
  );
  await spellingLoader({ path: main });
  assert.equal(
    spellingOptionResolutions,
    1,
    "relative and dot-segment files keys must not claim an absolute disk path",
  );

  if (process.platform === "win32") {
    const driveCaseVariant = main.replace(
      /^([a-z]):/i,
      (_match, drive: string) =>
        `${drive === drive.toLowerCase() ? drive.toUpperCase() : drive.toLowerCase()}:`,
    );
    assert.notEqual(driveCaseVariant, main);
    let equivalentOptionResolutions = 0;
    const { loader: equivalentLoader } = await captureBunLoader(
      unpluginBun(() => {
        ++equivalentOptionResolutions;
        return { plugins: [] };
      }),
      "bundler",
      {
        files: {
          [driveCaseVariant]: "export const driveCase = true;",
          [dotAbsoluteMain]: "export const dotted = true;",
        },
      },
    );
    assert.equal(
      await equivalentLoader({ path: main }),
      undefined,
      "Windows drive-letter case must preserve in-memory ownership",
    );
    assert.equal(
      await equivalentLoader({ path: dotAbsoluteMain.replace(/\\/g, "/") }),
      undefined,
      "separator normalization must preserve an identical dotted spelling",
    );
    assert.equal(
      equivalentOptionResolutions,
      0,
      "Bun-equivalent Windows spellings must not enter the disk transform",
    );
  }
}
