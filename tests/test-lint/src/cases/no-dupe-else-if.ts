function f(a: any, b: any) {
  if (a) {
    return 1;
  } else if (b) {
    return 2;
  }
  // expect: no-dupe-else-if error
  else if (a) {
    return 3;
  }
  return 0;
}
JSON.stringify(f);
