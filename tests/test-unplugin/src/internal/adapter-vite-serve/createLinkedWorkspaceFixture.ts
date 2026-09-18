import { TestProject, TestUnpluginProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import type { IViteServeCandidateFixture } from "./IViteServeCandidateFixture";

/** Materialize the linked-workspace fixture in a temporary directory. */
export function createLinkedWorkspaceFixture(): IViteServeCandidateFixture {
  TestUnpluginProject.ensureSharedCacheDir();
  const workspace = TestProject.tmpdir("ttsc-unplugin-vite-serve-");
  const linkedPackage = path.join(workspace, "packages", "linked-pkg");
  fs.mkdirSync(linkedPackage, { recursive: true });
  fs.writeFileSync(
    path.join(linkedPackage, "package.json"),
    JSON.stringify(
      { main: "index.js", name: "linked-pkg", version: "0.0.0" },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(linkedPackage, "index.js"),
    'export const linked = "js";\n',
    "utf8",
  );

  const app = path.join(workspace, "app");
  fs.mkdirSync(path.join(app, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(app, "package.json"),
    JSON.stringify(
      { dependencies: { "linked-pkg": "0.0.0" }, private: true },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(app, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          allowJs: true,
          module: "commonjs",
          outDir: "dist",
          rootDir: "src",
          strict: true,
          target: "ES2022",
          typeRoots: ["./node_modules/@types"],
          types: ["*"],
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "utf8",
  );
  const mainFile = path.join(app, "src", "main.ts");
  // The global assignment is a side effect so a production build cannot
  // tree-shake the import away; the build scenario asserts on the bundled
  // package binding.
  fs.writeFileSync(
    mainFile,
    'import { linked } from "linked-pkg";\n\nexport const value: string = linked;\n(globalThis as Record<string, unknown>).ttscLinkedValue = value;\n',
    "utf8",
  );
  const typeRoot = path.join(app, "node_modules", "@types");
  fs.mkdirSync(typeRoot, { recursive: true });
  // pnpm links workspace packages into node_modules as directory links; the
  // "junction" type keeps the link creatable without elevation on Windows and
  // degrades to an ordinary directory symlink on POSIX.
  fs.symlinkSync(
    linkedPackage,
    path.join(app, "node_modules", "linked-pkg"),
    "junction",
  );
  return {
    app,
    linkedPackage,
    mainFile,
    missingCandidate: path.join(app, "node_modules", "linked-pkg", "index.ts"),
    supersedingSource: path.join(linkedPackage, "index.ts"),
    typeRoot,
  };
}
