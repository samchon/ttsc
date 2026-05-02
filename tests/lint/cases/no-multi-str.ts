// expect: no-multi-str error
const s: string = "line1 \
line2";
JSON.stringify(s);