// @ttsc-corpus-clean: unicorn/no-invalid-fetch-options
declare function fetch(input: string, init: object): Promise<unknown>; fetch("https://example.com", { method: "POST", body: "x" });
