import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export const workspace = path.resolve(import.meta.dirname, "..");

/** Each host gets mutable inputs of its own and the same immutable Go source. */
export function fixture(name) {
  const root = path.join(workspace, ".contracts", name);
  assert.equal(path.dirname(root), path.join(workspace, ".contracts"));
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  write(
    root,
    "package.json",
    JSON.stringify({ private: true, type: "module" }),
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        types: [],
        jsx: "preserve",
        outDir: "dist-contract",
        plugins: [
          { transform: path.join(workspace, "unplugin-transform.cjs") },
        ],
      },
      include: ["src", "app", "pages"],
      exclude: ["dist-contract", "node_modules"],
    }),
  );
  write(root, "src/globals.d.ts", "declare function watchValue(): string;\n");
  write(
    root,
    "src/main.ts",
    [
      ...[1, 2, 3].map(
        (i) => `import { value as value${i} } from "./mod${i}.ts";`,
      ),
      "export const value = watchValue();",
      "console.log(value, value1, value2, value3);",
    ].join("\n"),
  );
  for (const i of [1, 2, 3])
    write(root, `src/mod${i}.ts`, "export const value = watchValue();\n");
  const input = path.join(root, "src/contract-input.server.ts");
  const change = (value) =>
    fs.writeFileSync(input, `export type ContractInput = "${value}";\n`);
  change("FIRST");
  return {
    root,
    input,
    change,
    break() {
      fs.writeFileSync(input, "export type ContractInput = ;\n");
    },
    entry: path.join(root, "src/main.ts"),
    output: path.join(root, "dist-contract/bundle.js"),
    options: { project: path.join(root, "tsconfig.json") },
    runs: () => fs.statSync(path.join(root, ".ttsc/contract-runs")).size,
  };
}

export function write(root, file, contents) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

export function expectOutput(code, value, consumers = 1) {
  const values = [
    ...code.matchAll(/(["'`])(FIRST|SECOND|THIRD|FOURTH)\1/g),
  ].map((match) => match[2]);
  assert.equal(
    values.length,
    consumers,
    `every consumer must retain its observable transformed value: ${code.slice(0, 500)}`,
  );
  assert.deepEqual(values, Array(consumers).fill(value));
  assert.ok(
    !code.includes("watchValue()"),
    "the transform must execute, not merely build successfully",
  );
}

/** Deadlines diagnose a missing event; successful runs pay no fixed sleep. */
export async function deadline(promise, label, milliseconds = 60_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out: ${label}`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function eventQueue() {
  const values = [];
  const waiters = [];
  return {
    push(value) {
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else values.push(value);
    },
    async next(label) {
      const value = values.length
        ? values.shift()
        : await deadline(
            new Promise((resolve) => waiters.push(resolve)),
            label,
          );
      if (value instanceof Error) throw value;
      return value;
    },
  };
}

/**
 * Hosts may report an already queued build before the edit reaches their
 * watcher.
 */
export async function changedOutput(events, label, value) {
  return deadline(
    (async () => {
      for (;;) {
        const code = await events.next(label);
        if (code.includes(value)) return code;
      }
    })(),
    label,
  );
}

export async function eventually(read, predicate, label) {
  const until = Date.now() + 30_000;
  let last;
  while (Date.now() < until) {
    try {
      last = await read();
      if (predicate(last)) return last;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(
    `${label}: ${last instanceof Error ? last.stack : String(last).slice(0, 1000)}`,
  );
}

export async function adapter(name, options) {
  return (await import(`@ttsc/unplugin/${name}`)).default(options);
}
