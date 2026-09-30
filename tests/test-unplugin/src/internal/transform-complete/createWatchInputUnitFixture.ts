import type { ITtscCompilerTransformation } from "ttsc";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";
import path from "node:path";

/** Create literal consumer inputs; no compiler, plugin binary or host is run. */
export function createWatchInputUnitFixture(): {
  root: string;
  universal: string[];
  collect: (result: ITtscCompilerTransformation.ISuccess) => string[];
} {
  const root = TestProject.tmpdir("ttsc-watch-input-unit-");
  TestProject.writeFiles(root, {
    "package.json": '{"private":true}',
    "plugin.cjs": "module.exports = {};\n",
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": "export const value = 1;\n",
  });
  const tsconfig = path.join(root, "tsconfig.json");
  const nearer = path.join(root, "src", "tsconfig.json");
  const universal = ["package.json", "plugin.cjs", "tsconfig.json"].map(
    (name) => path.join(root, name),
  );
  universal.push(nearer, path.join(root, "plugin-source"));
  return {
    root,
    universal,
    collect: (result) => {
      const watched: string[] = [];
      notifyWatchInputs(
        { addWatchFile: (input) => watched.push(input) },
        {
          inputHashes: {},
          membershipPolicy: readProjectMembershipPolicy(tsconfig),
          projectRoot: root,
          result,
          tsconfig,
        },
        path.join(root, "src", "main.ts"),
        {
          consulted: [nearer, tsconfig],
          filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
          tsconfig,
        },
      );
      return watched.sort();
    },
  };
}
