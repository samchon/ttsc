const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  spawn,
  ttscBin,
} = require("./_helpers.cjs");

function pluginProject(pluginEntries, pluginFiles) {
  return commonJsProject(
    {
      ...pluginFiles,
      "src/main.ts": `export const value: string = "plugin";\n`,
    },
    {
      compilerOptions: {
        plugins: pluginEntries,
      },
    },
  );
}

test("plugin corpus: default export factory is accepted", () => {
  const root = pluginProject(
    [{ transform: "./plugins/default.cjs", label: "default-shape" }],
    {
      "plugins/default.cjs": `
        exports.default = (config) => ({
          name: "default-export",
          transformOutput(context) {
            return context.code + "\\n// " + config.label + ":" + context.command;
          },
        });
      `,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /\/\/ default-shape:build\s*$/,
  );
});

test("plugin corpus: createTtscPlugin export is accepted", () => {
  const root = pluginProject(
    [{ transform: "./plugins/create.cjs" }],
    {
      "plugins/create.cjs": `
        exports.createTtscPlugin = () => ({
          name: "create-export",
          transformOutput(context) {
            return "// create:" + context.command + "\\n" + context.code;
          },
        });
      `,
    },
  );

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\/\/ create:transform\n/);
});

test("plugin corpus: conflicting native modes fail before build", () => {
  const root = pluginProject(
    [
      { transform: "./plugins/a.cjs" },
      { transform: "./plugins/b.cjs" },
    ],
    {
      "plugins/a.cjs": `module.exports = { name: "a", native: { mode: "alpha" } };\n`,
      "plugins/b.cjs": `module.exports = { name: "b", native: { mode: "beta" } };\n`,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /multiple native plugin modes requested/);
});

test("plugin corpus: invalid plugin export reports the bad specifier", () => {
  const root = pluginProject(
    [{ transform: "./plugins/invalid.cjs" }],
    {
      "plugins/invalid.cjs": `module.exports = 123;\n`,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not export a valid ttsc plugin/);
});

test("plugin corpus: transform --out receives transformOutput text", () => {
  const root = pluginProject(
    [{ transform: "./plugins/out.cjs" }],
    {
      "plugins/out.cjs": `
        module.exports = {
          name: "out",
          transformOutput(context) {
            return context.code + "\\n// out:" + context.command;
          },
        };
      `,
    },
  );
  const output = path.join(root, "custom", "main.js");

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", output],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(output, "utf8"), /\/\/ out:transform\s*$/);
});

test("plugin corpus: transformSource is lowered by the consumer tsgo target", () => {
  const root = commonJsProject(
    {
      "plugins/source.cjs": `
        module.exports = {
          name: "source-expression",
          transformSource(context) {
            const needle = "makeModern()";
            const start = context.code.lastIndexOf(needle);
            if (start < 0) return;
            return [{
              start,
              end: start + needle.length,
              code: "({ value: 'TARGET-LOWERED' }?.value ?? 'fallback')",
            }];
          },
        };
      `,
      "src/main.ts": `
        function makeModern(): string {
          return "not transformed";
        }
        export const value: string = makeModern();
        console.log(value);
      `,
    },
    {
      compilerOptions: {
        target: "ES2015",
        plugins: [{ transform: "./plugins/source.cjs" }],
      },
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /\?\./);
  assert.doesNotMatch(js, /\?\?/);
  assert.match(js, /TARGET-LOWERED/);
  const run = spawn(process.execPath, [path.join(root, "dist", "main.js")], {
    cwd: root,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "TARGET-LOWERED");
});

test("plugin corpus: transformSource build preserves source map paths", () => {
  const root = commonJsProject(
    {
      "plugins/source-map.cjs": `
        module.exports = {
          name: "source-map-expression",
          transformSource(context) {
            const needle = "makeModern<IMember>()";
            const start = context.code.lastIndexOf(needle);
            if (start < 0) return;
            return {
              edits: [{
                start,
                end: start + needle.length,
                code: "(() => {\\n  const box = { value: 'MAP-LOWERED' };\\n  return box?.value ?? 'fallback';\\n})()",
              }],
            };
          },
        };
      `,
      "src/main.ts": [
        "type IMember = { name: string };",
        "",
        "const assert = makeModern<IMember>();",
        "",
        'console.log("assert function ready");',
        "",
        "declare function makeModern<T>(): (input: T) => T;",
        "",
      ].join("\n"),
    },
    {
      compilerOptions: {
        inlineSources: true,
        sourceMap: true,
        target: "ES2015",
        plugins: [{ transform: "./plugins/source-map.cjs" }],
      },
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const mapFile = path.join(root, "dist", "main.js.map");
  assert.equal(fs.existsSync(mapFile), true);
  const mapText = fs.readFileSync(mapFile, "utf8");
  const map = JSON.parse(mapText);
  assert.deepEqual(map.sources, ["../src/main.ts"]);
  assert.doesNotMatch(mapText, /ttsc-source-/);
  assert.match(map.sourcesContent?.[0] ?? "", /makeModern<IMember>\(\)/);
  const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
  assert.doesNotMatch(js, /\?\.|\?\?/);

  const mappings = decodeMappings(map.mappings);
  const generatedLines = js.split(/\r?\n/);
  const replacementLine = generatedLines.findIndex((line) =>
    line.includes("MAP-LOWERED"),
  );
  const consoleLine = generatedLines.findIndex((line) =>
    line.includes("assert function ready"),
  );
  assert.notEqual(replacementLine, -1);
  assert.notEqual(consoleLine, -1);
  assert.equal(mappedOriginalLines(mappings, replacementLine).has(2), true);
  assert.equal(mappedOriginalLines(mappings, consoleLine).has(4), true);
});

function mappedOriginalLines(mappings, generatedLine) {
  return new Set(
    (mappings[generatedLine] ?? [])
      .filter((segment) => segment.length >= 4)
      .map((segment) => segment[2]),
  );
}

function decodeMappings(mappings) {
  const lines = [];
  let line = [];
  let segment = [];
  let index = 0;
  const state = [0, 0, 0, 0, 0];
  while (index < mappings.length) {
    const char = mappings[index];
    if (char === ";") {
      if (segment.length > 0) {
        line.push(segment);
        segment = [];
      }
      lines.push(line);
      line = [];
      state[0] = 0;
      index += 1;
      continue;
    }
    if (char === ",") {
      if (segment.length > 0) {
        line.push(segment);
        segment = [];
      }
      index += 1;
      continue;
    }
    const read = readVlq(mappings, index);
    index = read.next;
    const field = segment.length;
    state[field] += read.value;
    segment.push(state[field]);
  }
  if (segment.length > 0) {
    line.push(segment);
  }
  lines.push(line);
  return lines;
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_VALUES = new Map(
  [...BASE64_CHARS].map((char, index) => [char, index]),
);

function readVlq(input, start) {
  let index = start;
  let shift = 0;
  let value = 0;
  while (index < input.length) {
    const digit = BASE64_VALUES.get(input[index]);
    assert.notEqual(digit, undefined);
    index += 1;
    const continuation = (digit & 32) !== 0;
    value += (digit & 31) << shift;
    shift += 5;
    if (!continuation) {
      const negative = (value & 1) === 1;
      const decoded = value >> 1;
      return { next: index, value: negative ? -decoded : decoded };
    }
  }
  throw new Error("unterminated VLQ");
}
