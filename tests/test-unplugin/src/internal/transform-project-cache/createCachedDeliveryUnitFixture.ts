import { createHash } from "node:crypto";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import type { ResolvedTtscUnpluginOptions } from "../../../../../packages/unplugin/src/core/options/ResolvedTtscUnpluginOptions";
import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/TtscTransformCache";
import { beginTtscTransformBuild } from "../../../../../packages/unplugin/src/core/transform/cache/beginTtscTransformBuild";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { transformTtsc } from "../../../../../packages/unplugin/src/core/transform/transformTtsc";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Literal generation input for the actual delivery coordinator, without a
 * producer.
 */
export function createCachedDeliveryUnitFixture(): {
  api: { transformTtsc: typeof transformTtsc };
  cache: TtscTransformCache;
  key: string;
  good: TtscCachedProjectTransform & {
    result: ITtscCompilerTransformation.ISuccess;
  };
  file: string;
  source: string;
  options: ResolvedTtscUnpluginOptions;
  code: string;
  dispose: () => void;
} {
  const root = TestProject.tmpdir("ttsc-cached-delivery-unit-");
  const source = 'export const value = goUpper("plugin");\n';
  const code = 'export const value = "PLUGIN";\n';
  TestProject.writeFiles(root, {
    "src/main.ts": source,
    "tsconfig.json": '{"include":["src"]}',
  });
  const file = path.join(root, "src", "main.ts");
  const tsconfig = path.join(root, "tsconfig.json");
  const options = resolveOptions({ project: tsconfig });
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  // This is the consumer's settled-pass input, not a claim that a native
  // compiler observed this fixture. Actual capture/admission remains E2E.
  const good: TtscCachedProjectTransform & {
    result: ITtscCompilerTransformation.ISuccess;
  } = {
    deliveryEpoch: 1,
    inputHashes: {
      "src/main.ts": createHash("sha256").update(source).digest("hex"),
    },
    membershipPolicy: readProjectMembershipPolicy(tsconfig),
    projectRoot: root,
    projectSnapshotComplete: true,
    result: { type: "success", typescript: { "src/main.ts": code } },
    tsconfig,
  };
  const key = createTransformCacheKey({
    aliasPaths: {},
    compilerOptions: options.compilerOptions,
    plugins: options.plugins,
    tsconfig,
  });
  return {
    api: { transformTtsc },
    cache,
    key,
    good,
    file,
    source,
    options,
    code,
    dispose: () => resetTtscTransformCache(cache),
  };
}
