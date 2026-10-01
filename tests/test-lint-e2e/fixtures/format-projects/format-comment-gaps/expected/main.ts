function run(): void {
  const a = 1;
  const b = 2;
  // standalone leading comment
  const c = 3;
  const d = 4; // trailing line comment
  /** A block comment on its own lines */
  const e = 5;
  console.log(a, b, c, d, e);
}
