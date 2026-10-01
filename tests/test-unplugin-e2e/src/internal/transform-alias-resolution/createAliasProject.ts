import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

/**
 * Fixture options for the alias-resolution projects.
 *
 * `basePathsInExtendedJsonc` moves the `paths` declaration into an extended
 * JSONC base config under `config/`, exercising the `extends`-chain walk and
 * comment/trailing-comma tolerance of the generated-tsconfig overlay.
 */
interface IAliasProjectOptions {
  basePathsInExtendedJsonc?: boolean;
}

/**
 * Create a plugin-free project with two tsconfig path mappings: `@/*` →
 * `./src/*` (also mirrored by the forwarded bundler alias in tests) and
 * `#lib/*` → `./lib/*` (tsconfig-only). Plugin-free matters: the transform then
 * runs the real TypeScript-Go program and surfaces semantic diagnostics, which
 * is how these tests observe whether an aliased type actually resolved or
 * silently collapsed to `any`.
 */
export function createAliasProject(options: IAliasProjectOptions = {}): string {
  const root = TestProject.tmpdir("ttsc-unplugin-alias-");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "lib"), { recursive: true });
  const compilerOptions = {
    module: "ESNext",
    moduleResolution: "bundler",
    target: "ES2022",
    strict: true,
  };
  if (options.basePathsInExtendedJsonc) {
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "config", "tsconfig.base.json"),
      [
        "{",
        "  // paths live in an extended JSONC base on purpose:",
        "  // targets must stay anchored at this config's directory.",
        '  "compilerOptions": {',
        '    "paths": { "@/*": ["../src/*"], "#lib/*": ["../lib/*"], },',
        "  },",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          extends: "./config/tsconfig.base.json",
          compilerOptions,
          include: ["src", "lib"],
        },
        null,
        2,
      ),
      "utf8",
    );
  } else {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            ...compilerOptions,
            paths: { "@/*": ["./src/*"], "#lib/*": ["./lib/*"] },
          },
          include: ["src", "lib"],
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  fs.writeFileSync(
    path.join(root, "src", "types.ts"),
    "export interface Foo { id: number; name: string }\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "lib", "other.ts"),
    "export interface Bar { flag: boolean }\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ private: true, type: "commonjs" }, null, 2),
    "utf8",
  );
  return root;
}
