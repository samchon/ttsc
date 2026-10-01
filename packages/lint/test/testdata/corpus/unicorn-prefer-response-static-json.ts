// expect: unicorn/prefer-response-static-json error
const r = new Response(JSON.stringify({ ok: true }));
void r;
