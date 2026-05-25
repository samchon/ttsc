const s: string =
  // expect: noMultiStr error
  "line1 \
line2";
JSON.stringify(s);
