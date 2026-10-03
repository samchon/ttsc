// @ttsc-corpus-clean: unicorn/prefer-top-level-await
declare function load(): Promise<string>; const s = await load(); void s;
