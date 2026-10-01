declare function fetch(input: string, init: object): Promise<unknown>;
// expect: unicorn/no-invalid-fetch-options error
fetch("https://example.com", { method: "GET", body: "x" });
