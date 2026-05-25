const s: string =
  // expect: no-multi-str error
  "line1 \
line2";
JSON.stringify(s);
