declare function require(path: string): {
  default: { make(input: string): string };
};
const plugin_99 = require("./plugin");
import plugin from "./plugin";
export const decoy = plugin_99.default.make("kept");
export const first = plugin.make("first");
export const second = plugin.make("second");
