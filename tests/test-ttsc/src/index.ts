import fs from "node:fs";
import path from "node:path";

import { TestExecutor } from "../../utils/src/TestExecutor";

const features = path.join(process.cwd(), "src", "features");
const nativeDirectory = "native-linux";
const locations = fs
  .readdirSync(features, { withFileTypes: true })
  .filter((entry) => entry.isFile() || entry.isDirectory())
  .filter((entry) => entry.name !== nativeDirectory)
  .map((entry) => path.join(features, entry.name));
const nativeName =
  "test_linkvirtualentry_copies_a_file_symlink_entry_when_symlink_creation_fails";
const nativeFile = `${nativeName}.ts`;
const include = process.argv
  .slice(2)
  .filter((value) => value.startsWith("--include="))
  .flatMap((value) => value.slice("--include=".length).split(","))
  .map((value) => value.trim())
  .filter(Boolean);
const exclude = process.argv
  .slice(2)
  .filter((value) => value.startsWith("--exclude="))
  .flatMap((value) => value.slice("--exclude=".length).split(","))
  .map((value) => value.trim())
  .filter(Boolean);
const nativeAdmitted = process.platform === "linux";
const nativeSelected =
  nativeAdmitted &&
  (!include.length || include.some((value) => nativeFile.includes(value))) &&
  exclude.every((value) => !nativeFile.includes(value));
if (nativeAdmitted) locations.push(path.join(features, nativeDirectory));
// Admission is not invocation, failure, skip or PASS. The executor's named
// outcome supplies those observations, including the existing zero-test error.
console.log(
  "native-linux admission",
  JSON.stringify({
    selected: nativeSelected ? [nativeName] : [],
    unselected: nativeSelected
      ? []
      : [
          {
            name: nativeName,
            reason: nativeAdmitted
              ? "CLI filter"
              : `platform ${process.platform}`,
          },
        ],
  }),
);

TestExecutor.main({ location: locations }).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
