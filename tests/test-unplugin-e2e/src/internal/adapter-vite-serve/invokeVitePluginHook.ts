/** Apply one unplugin hook, tolerating both the bare and object hook forms. */
export function invokeVitePluginHook(
  hook: any,
  context: object,
  ...args: unknown[]
): unknown {
  return typeof hook === "function"
    ? hook.apply(context, args)
    : hook?.handler?.apply(context, args);
}
