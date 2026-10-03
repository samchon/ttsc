/**
 * A project whose one CommonJS plugin descriptor counts its own evaluations,
 * for tests of which loads reuse a recorded descriptor evaluation
 * (`PluginDescriptorEvaluationCache`, samchon/ttsc#1497, samchon/ttsc#1561).
 */
import { TestProject } from "@ttsc/testing";

import { fs, loadProjectPlugins, path } from "./project";
import { createFakeGoBinary } from "./source-build";

export interface IDescriptorEvaluationProject {
  /** The cache root the loads use. */
  cacheRoot: string;
  /** The project directory, which holds `plugin.cjs` and `go-plugin`. */
  directory: string;
  /** How many times the descriptor's factory has run. */
  evaluations: () => number;
  /** Load the project's plugins with one cache, returning the plugin's name. */
  load: () => string | undefined;
}

/**
 * Write the project and return its loader.
 *
 * @param prefix The temporary directory prefix.
 * @param files Files to write into the project, by relative path.
 * @param factory The body of the descriptor's factory, which receives `context`
 *   and returns the descriptor; `fs` and `path` are in scope, and each call is
 *   counted before the body runs.
 * @param options.defaultCacheRoot Load with the default project-local cache
 *   root, which ttsc collects, instead of a named one.
 */
export function createDescriptorEvaluationProject(
  prefix: string,
  files: Record<string, string>,
  factory: string,
  options: { defaultCacheRoot?: boolean } = {},
): IDescriptorEvaluationProject {
  const root = TestProject.tmpdir(prefix);
  TestProject.retainTemporaryDirectory(root, "Descriptor evaluation descendants are not joined");
  const directory = path.join(root, "project");
  const counter = path.join(root, "evaluations.txt");
  writeGoModule(path.join(directory, "go-plugin"));
  write(
    path.join(directory, "package.json"),
    JSON.stringify({ private: true }),
  );
  for (const [relative, content] of Object.entries(files))
    write(path.join(directory, relative), content);
  write(
    path.join(directory, "plugin.cjs"),
    [
      `const fs = require("node:fs");`,
      `const path = require("node:path");`,
      `module.exports = (context) => {`,
      `  fs.appendFileSync(process.env.DESCRIPTOR_COUNTER, "x");`,
      factory,
      `};`,
      ``,
    ].join("\n"),
  );
  write(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "commonjs",
        plugins: [{ transform: "./plugin.cjs" }],
      },
    }),
  );
  const fakeGo = path.join(root, "fake-go");
  fs.mkdirSync(fakeGo, { recursive: true });
  // An installation pins the project as the workspace root its default cache
  // root belongs to.
  fs.mkdirSync(path.join(directory, "node_modules"), { recursive: true });
  const cacheRoot =
    options.defaultCacheRoot === true
      ? path.join(directory, "node_modules", ".cache", "ttsc")
      : path.join(root, "cache");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DESCRIPTOR_COUNTER: counter,
    TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
    TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
  };
  if (options.defaultCacheRoot === true) delete env.TTSC_CACHE_DIR;
  return {
    cacheRoot,
    directory,
    evaluations: () =>
      fs.existsSync(counter) ? fs.readFileSync(counter, "utf8").length : 0,
    load: () =>
      loadProjectPlugins({
        binary: "",
        cacheDir: options.defaultCacheRoot === true ? undefined : cacheRoot,
        cwd: directory,
        env,
        tsconfig: path.join(directory, "tsconfig.json"),
      }).nativePlugins[0]!.name,
  };
}

/** A Go module the fake toolchain accepts. */
function writeGoModule(directory: string): void {
  write(
    path.join(directory, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
  );
  write(path.join(directory, "main.go"), "package main\n");
  // The files the fake Go build requires of the module it compiles.
  for (const relative of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    write(path.join(directory, relative), "package generated\n");
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
