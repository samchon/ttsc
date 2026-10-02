function require(_path: string) {
  return { default: { make: (input: string) => "decoy:" + input } };
}
function __importDefault<T>(value: T): T {
  return value;
}
const plugin_99 = __importDefault(require("./plugin.js"));
import plugin from "./plugin.js";
export const decoy = plugin_99.default.make("kept");
export const value = plugin.make("input");
