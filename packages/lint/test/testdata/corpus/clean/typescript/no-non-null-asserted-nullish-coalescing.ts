// @ttsc-corpus-clean: typescript/no-non-null-asserted-nullish-coalescing
declare const maybe: string | undefined;
const value = maybe ?? "fallback";
