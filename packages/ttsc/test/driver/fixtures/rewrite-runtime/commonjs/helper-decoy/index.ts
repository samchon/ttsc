declare function require(path: string): {
  default: { make(input: string): string };
};
function __importDefault<T>(value: T): T {
  return value;
}
const plugin_99 = __importDefault(require("./plugin"));
import plugin from "./plugin";
export const decoy = plugin_99.default.make("kept");
export const value = plugin.make("input");
