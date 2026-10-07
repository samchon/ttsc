declare const base: string;
const u = new URL(
  // expect: unicorn/relative-url-style error
  "./foo",
  base,
);
void u;
