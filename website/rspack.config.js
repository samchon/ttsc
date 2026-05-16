const path = require("path");

/**
 * Bundles the playground compiler worker.
 *
 * Output: `public/compiler/index.js`. The worker boots `playground.wasm`
 * (built separately by `build/compiler.cjs`) through `@ttsc/wasm`'s
 * `bootTtsc` helper and exposes ICompilerService over tgrid's WorkerServer.
 *
 * `target: "webworker"` ensures Node-only modules referenced by transitive
 * deps are resolved through browser shims or left empty when never reached
 * at runtime.
 */
module.exports = {
  entry: ["./src/compiler/index.ts"],
  output: {
    path: path.join(__dirname, "public", "compiler"),
    filename: "index.js",
    chunkFormat: false,
  },
  optimization: {
    minimize: true,
  },
  mode: "production",
  target: "webworker",
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: "ts-loader",
        options: {
          configFile: "tsconfig.rspack.json",
          transpileOnly: true,
        },
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    fallback: {
      fs: false,
      "node:fs": false,
      path: false,
      "node:path": false,
      "node:url": false,
      url: false,
      os: false,
      "node:os": false,
      crypto: false,
      "node:crypto": false,
      stream: false,
      "node:stream": false,
      buffer: false,
      "node:buffer": false,
      util: false,
      "node:util": false,
    },
  },
  performance: {
    hints: false,
  },
};
