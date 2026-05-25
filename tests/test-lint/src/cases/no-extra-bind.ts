// expect: noExtraBind error
const f = (() => 1).bind({});
JSON.stringify(f);
