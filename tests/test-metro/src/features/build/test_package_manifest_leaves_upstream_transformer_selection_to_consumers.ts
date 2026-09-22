import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the Metro package leaves upstream transformer selection to the
 * consuming Expo or React Native project.
 *
 * The three auto-detected transformers are alternatives already supplied by the
 * consumer's framework. Declaring all of them as optional peers made pnpm
 * install every alternative for this workspace and forced a global
 * `autoInstallPeers: false` workaround.
 *
 * 1. Read the @ttsc/metro package manifest.
 * 2. Check each auto-detected upstream transformer across installable dependency
 *    fields.
 * 3. Assert none is installed or requested by the adapter package itself.
 */
export const test_package_manifest_leaves_upstream_transformer_selection_to_consumers =
  () => {
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "metro",
          "package.json",
        ),
        "utf8",
      ),
    ) as Record<string, Record<string, string> | undefined>;
    const dependencyFields = [
      manifest.dependencies,
      manifest.optionalDependencies,
      manifest.peerDependencies,
    ];

    for (const upstream of [
      "@expo/metro-config",
      "@react-native/metro-babel-transformer",
      "metro-react-native-babel-transformer",
    ])
      assert.equal(
        dependencyFields.some((dependencies) => dependencies?.[upstream]),
        false,
        `${upstream} must be supplied by the consuming framework`,
      );
  };
