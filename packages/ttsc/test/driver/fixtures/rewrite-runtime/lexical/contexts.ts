const plugin = { ns: { make(...input: unknown[]): string { return "original"; } } };
const holder = { plugin };
const 橘plugin = { ns: { make(): string { return "adjacent"; } } };
const 플러그인 = { 네임: { 만들기(input: string): string { return input; } } };
export const quoted = "plugin.ns.make()";
export const templateText = `plugin.ns.make()`;
export const regexText = /plugin.ns.make()/.source;
export const receiver = holder.plugin.ns.make();
export const adjacent = 橘plugin.ns.make();
// plugin.ns.make()
/* plugin.ns.make() */
export const first = plugin.ns
  .make({ nested: ")", regex: (() => /[)}]/)() }, `x${/}/.test("}") ? "yes" : "no"}`);
export const templateExpression = `before plugin.ns.make() ${plugin.ns.make("inside")} after`;
export const nested = plugin.ns.make(plugin.ns.make("inner"));
export const unicode = 플러그인.네임.만들기("unicode");
