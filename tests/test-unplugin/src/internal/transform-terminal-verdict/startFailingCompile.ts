import { TestUnpluginRuntime } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { createRealNativeEnvelopeFixture } from "../real-native-envelope/createRealNativeEnvelopeFixture";

/**
 * A real native-host project whose program carries one type error.
 *
 * The linked contributor shares the compiler's own program, so the transform
 * really does see the program's diagnostics. A sidecar fixture cannot stand in
 * here: its transform lane never type-checks, so a planted type error would
 * produce an ordinary `"success"` and the scenario would assert nothing.
 *
 * Native type errors retain a structured failure envelope and its dependency
 * graph. The adapter bounds repeated attempts by the delivery pass for both
 * these diagnostics and opaque host exceptions.
 */
export async function startFailingCompile(broken = true): Promise<{
  api: any;
  brokenFile: string;
  cache: Map<string, Promise<unknown>>;
  deliver: (file: string) => Promise<unknown>;
  modules: string[];
}> {
  const fixture = createRealNativeEnvelopeFixture();
  const brokenFile = path.join(fixture.root, "src", "broken.ts");
  if (broken) {
    fs.writeFileSync(
      brokenFile,
      "export const broken: number = 'text';\n",
      "utf8",
    );
  }
  const api = await TestUnpluginRuntime.loadUnpluginApi();
  const cache = api.createTtscTransformCache();
  const options = api.resolveOptions({
    project: path.join(fixture.root, "tsconfig.json"),
  });
  return {
    api,
    brokenFile,
    cache,
    deliver: (file: string) =>
      api.transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        options,
        undefined,
        cache,
      ),
    modules: fixture.modules,
  };
}
