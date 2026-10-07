import { createRequire } from "node:module";

globalThis.require = createRequire(new URL("./dist/loader.js", import.meta.url));
const parameter = await import("./dist/parameter.js");
const local = await import("./dist/local.js");
const imported = await import("./dist/imported.js");
const loader = await import("./dist/loader.js");
const unbound = await import("./dist/unbound.js");
process.stdout.write(
  JSON.stringify([
    parameter.value((id) => id),
    local.value(),
    imported.value,
    loader.loaded,
    unbound.loaded,
  ]),
);
