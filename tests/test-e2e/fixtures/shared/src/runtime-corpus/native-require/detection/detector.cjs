module.exports = {
  config: typeof require.extensions[".ts"] === "function" ? require("./config.ts").value : "missing-typescript-handler",
  lone: require("./both/y"),
  loneResolved: require.resolve("./both/y").endsWith("y.ts"),
  nodeHandler: require.extensions[".ts"] === require.extensions[".js"],
  precedence: require("./both/x"),
};
