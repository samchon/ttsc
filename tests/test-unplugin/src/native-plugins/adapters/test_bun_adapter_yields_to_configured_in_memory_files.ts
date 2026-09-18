import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { captureBunLoader } from "../../internal/adapter-bun/captureBunLoader";

/**
 * Verifies Bun build files remain owned by Bun's in-memory loader.
 *
 * `BuildConfig.files` can introduce a path with no disk entry or override an
 * existing one. Reading either through the filesystem violates Bun's stated
 * priority and can produce an `ENOENT` or transform stale disk contents.
 */
export async function test_bun_adapter_yields_to_configured_in_memory_files(): Promise<void> {
  const unpluginBun = await TestUnpluginRuntime.loadUnpluginAdapter("bun");
  const root = TestUnpluginProject.createProject();
  const main = TestUnpluginProject.mainFile(root);
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
