import { TestUnpluginRuntime } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/** The bundler alias map mirroring the project's `@/*` tsconfig mapping. */
function overlappingAliases(root: string): Record<string, string> {
  return { "@": path.join(root, "src") };
}

/** Run `transformTtsc` over `src/main.ts` with the given source text. */
export async function transformMain(
  root: string,
  source: string,
): Promise<unknown> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const file = path.join(root, "src", "main.ts");
  fs.writeFileSync(file, source, "utf8");
  return transformTtsc(
    file,
    source,
    resolveOptions({}),
    overlappingAliases(root),
  );
}
