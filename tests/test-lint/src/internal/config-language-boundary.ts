import { createLintProject, runLintProject } from "./config-file";

let completed: ReturnType<typeof runLintProject> | undefined;
let failed: { error: unknown } | undefined;

/** One builtin native host load with nine independently scoped config inputs. */
export function configLanguageBoundaryResult(): ReturnType<typeof runLintProject> {
  if (failed) throw failed.error;
  if (completed) return completed;
  try {
    const project = createLintProject({
      name: "config-language-boundary-batch",
      source: "export const empty = 1;\n",
      pluginConfig: { configFile: "./ttsc-lint.config.json" },
      extraSources: {
        "tsconfig.json": "{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"commonjs\",\"strict\":true,\"noEmit\":true,\"plugins\":[{\"transform\":\"@ttsc/lint\",\"configFile\":\"./ttsc-lint.config.json\"}]},\"files\":[\"src/main.ts\",\"configs/commonjs-globals/commonjs-globals.ts\",\"configs/module-meta/module-meta.ts\",\"configs/mts/mts.ts\",\"configs/cts/cts.ts\",\"configs/exported-types/exported-types.ts\",\"configs/js-sibling/js-sibling.ts\",\"configs/plain-ts/plain-ts.ts\",\"configs/mjs/mjs.ts\",\"configs/json/json.ts\"]}",
  "configs/commonjs-globals/ttsc-lint.config.ts": "const here: string = __dirname;\nexport default Object.assign({\n    rules: { \"no-console\": here.length > 0 ? \"error\" : \"off\" },\n}, {\n    files: [\"commonjs-globals.ts\"],\n    extends: \"../module-meta/ttsc-lint.config.ts\"\n});\n",
  "configs/commonjs-globals/commonjs-globals.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/module-meta/package.json": "{\n  \"name\": \"module-package-fixture\",\n  \"version\": \"1.0.0\",\n  \"type\": \"module\"\n}\n",
  "configs/module-meta/ttsc-lint.config.ts": "const here: string = import.meta.url;\nexport default Object.assign({\n    rules: { \"no-console\": here.startsWith(\"file:\") ? \"error\" : \"off\" },\n}, {\n    files: [\"module-meta.ts\"],\n    extends: \"../mts/ttsc-lint.config.mts\"\n});\n",
  "configs/module-meta/module-meta.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/mts/ttsc-lint.config.mts": "export default Object.assign({\n    rules: { \"no-var\": \"error\" },\n}, {\n    files: [\"mts.ts\"],\n    extends: \"../cts/ttsc-lint.config.cts\"\n});\n",
  "configs/mts/mts.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/cts/ttsc-lint.config.cts": "const config = {\n    rules: { \"no-console\": \"error\" },\n};\nexport = Object.assign(config, {\n    files: [\"cts.ts\"],\n    extends: \"../exported-types/ttsc-lint.config.ts\"\n});\n",
  "configs/cts/cts.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/exported-types/ttsc-lint.config.ts": "import type { ITtscLintConfig } from \"@ttsc/lint\";\nconst config = {\n    rules: {\n        \"no-var\": \"error\",\n        \"no-console\": \"off\",\n    },\n} satisfies ITtscLintConfig;\nexport default Object.assign(config, {\n    files: [\"exported-types.ts\"],\n    extends: \"../js-sibling/ttsc-lint.config.ts\"\n});\n",
  "configs/exported-types/exported-types.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/js-sibling/rules.ts": "export const rules = { \"no-console\": \"error\" };\n",
  "configs/js-sibling/ttsc-lint.config.ts": "import { rules } from \"./rules.js\";\nexport default Object.assign({ rules }, {\n    files: [\"js-sibling.ts\"],\n    extends: \"../plain-ts/ttsc-lint.config.ts\"\n});\n",
  "configs/js-sibling/js-sibling.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/plain-ts/ttsc-lint.config.ts": "export default Object.assign({\n    rules: {\n        \"no-var\": \"error\",\n        \"no-console\": \"off\",\n    },\n}, {\n    files: [\"plain-ts.ts\"],\n    extends: \"../mjs/ttsc-lint.config.mjs\"\n});\n",
  "configs/plain-ts/plain-ts.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/mjs/ttsc-lint.config.mjs": "export default Object.assign({\n    rules: { \"no-var\": \"error\" },\n}, {\n    files: [\"mjs.ts\"],\n    extends: \"../json/ttsc-lint.config.json\"\n});\n",
  "configs/mjs/mjs.ts": "var value = 1;\nconsole.log(value);\n",
  "configs/json/ttsc-lint.config.json": "{\"rules\":{\"no-var\":\"error\"},\"files\":[\"json.ts\"]}",
  "configs/json/json.ts": "var value = 1;\nconsole.log(value);\n",
  "ttsc-lint.config.json": "{\"extends\":\"./configs/commonjs-globals/ttsc-lint.config.ts\"}",
  "lint.config.json": "{\"rules\":{}}"
},
      linkNodeModules: ["@types/node"],
    });
    try {
      completed = runLintProject(project.tmpdir);
      return completed;
    } finally {
      project.cleanup();
    }
  } catch(error) {
    failed = {error};
    throw error;
  }
}
