import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { matchesProjectRootFile } from "../../../../../packages/unplugin/lib/core/tsconfig/matchesProjectRootFile.mjs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.mjs";

/**
 * Verifies root-file matching follows TypeScript-Go's wildcard rules for tool
 * output, JSON, and minified JavaScript.
 *
 * Wildcards never enter package folders or hidden paths, so `node_modules`,
 * `.cache`, and `.turbo` are outside a default include, while a spec that names
 * such a directory literally still reaches it. With `resolveJsonModule`,
 * TypeScript-Go admits a JSON file only through a literal entry or an include
 * spec ending in `.json`, so `vitest --coverage` writing JSON under
 * `coverage/.tmp` is not membership for the default include
 * (samchon/ttsc#1385). A wildcard leaves out `.min.js` files unless it spells
 * `.min.` itself.
 *
 * 1. Match tool output, sources, JSON, and minified files under a default include
 *    with `allowJs` and `resolveJsonModule`.
 * 2. Match JSON under an include that lists a `.json` spec, and a literal file.
 * 3. Match dotted and package directories named literally, and a wildcard that
 *    spells `.min.`.
 * 4. Assert each file and directory answer is TypeScript-Go's.
 */
export async function test_membership_policy_matches_root_files_as_typescript_go_does(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unplugin-root-match-");
  const policy = (config: Record<string, unknown>) => {
    TestProject.writeFiles(root, {
      "tsconfig.json": JSON.stringify({
        compilerOptions: { allowJs: true, resolveJsonModule: true },
        ...config,
      }),
    });
    return readProjectMembershipPolicy(path.join(root, "tsconfig.json"));
  };
  const table = (
    config: Record<string, unknown>,
    rows: [string, boolean, boolean][],
  ): void => {
    const current = policy(config);
    for (const [relative, directory, expected] of rows) {
      assert.equal(
        matchesProjectRootFile(path.join(root, relative), current, directory),
        expected,
        `${JSON.stringify(config)}: ${relative}${directory ? "/" : ""}`,
      );
    }
  };

  table({}, [
    ["src/main.ts", false, true],
    ["lib", true, true],
    ["lib/new.ts", false, true],
    ["vendor/plugin.js", false, true],
    ["node_modules", true, false],
    ["node_modules/.vite-temp/config.ts", false, false],
    ["node_modules/.prisma/client/index.d.ts", false, false],
    ["packages/app/node_modules/dep/index.ts", false, false],
    [".cache", true, false],
    [".turbo/cache.ts", false, false],
    [".git/hooks/pre-commit.ts", false, false],
    [".ttsc/plugin.ts", false, false],
    ["coverage", true, true],
    ["coverage/.tmp/coverage-0.json", false, false],
    ["data/values.json", false, false],
    ["vendor/bundle.min.js", false, false],
    ["vendor/bundle.min.js", true, true],
  ]);
  table({ include: ["**/*", "data/*.json"], files: ["settings.json"] }, [
    ["data/values.json", false, true],
    ["data/nested/values.json", false, false],
    ["other/values.json", false, false],
    ["settings.json", false, true],
    ["src/main.ts", false, true],
  ]);
  table(
    {
      include: [".react-router/types/**/*", "src/**/*.min.js"],
      files: ["node_modules/pkg/index.ts"],
    },
    [
      [".react-router", true, true],
      [".react-router/types/+routes.ts", false, true],
      ["src/vendor.min.js", false, true],
      ["src/vendor.js", false, false],
      ["node_modules", true, true],
      ["node_modules/pkg/index.ts", false, true],
      ["node_modules/other/index.ts", false, false],
    ],
  );
}
