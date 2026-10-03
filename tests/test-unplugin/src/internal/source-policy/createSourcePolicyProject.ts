import { TestProject } from "../../../../utils/src/TestProject";

/** Create only the literal config/source inputs consumed by policy units. */
export function createSourcePolicyProject(
  options: { fileCount?: number; outDir?: string } = {},
): { root: string } {
  const root = TestProject.tmpdir("ttsc-unplugin-source-policy-");
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ private: true, type: "commonjs" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        rootDir: "src",
        outDir: options.outDir ?? "dist",
      },
      include: ["src"],
    }),
    ...Object.fromEntries(
      Array.from({ length: options.fileCount ?? 6 }, (_, index) => [
        "src/mod" + index + ".ts",
        "export const value" + index + ': string = "PROBE";\n',
      ]),
    ),
  });
  return { root };
}
