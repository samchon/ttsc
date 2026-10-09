const state = ((globalThis as any).__ttscPackageStars ??= { leaf: 0, source: 0 });
++state.source;
export const sourceOnly = "owned-source";
export function sourceLoadCount(): number { return state.source; }
