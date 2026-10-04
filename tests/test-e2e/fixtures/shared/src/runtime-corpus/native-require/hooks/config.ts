declare const require: any;
declare const __dirname: string;
const Module = require("node:module");
export const target: string = require("./target.js").value;
export const resolved: boolean = require.resolve("./target.js").endsWith("target.ts");
export const resolvedFromPaths: boolean = require
  .resolve("./target.js", { paths: [__dirname] })
  .endsWith("target.ts");
export const handler: boolean = require.extensions[".ts"] === require.extensions[".js"];
export const wrapped: boolean = Module._resolveFilename.name === "resolveFilename";
