declare const require: any;
const extensions = require.extensions;
// What rechoir.prepare checks before it loads a config.
const detected = typeof extensions[".ts"] === "function";
console.log(JSON.stringify({
  config: detected ? require("./config.ts").value : "refused",
  lone: require("./both/y"),
  loneResolved: require.resolve("./both/y").endsWith("y.ts"),
  nodeHandler: extensions[".ts"] === extensions[".js"],
  precedence: require("./both/x"),
}));

export {};
