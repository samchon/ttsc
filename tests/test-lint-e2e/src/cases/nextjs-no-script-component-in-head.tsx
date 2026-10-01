import Head from "next/head";
import Script from "next/script";

// Positive: `<Script>` placed inside `next/head`.
const a = (
  <Head>
    {/* expect: nextjs/no-script-component-in-head error */}
    <Script src="/x.js" />
  </Head>
);

// Negative: `<Script>` rendered outside `<Head>`.
const b = <Script src="/x.js" />;

JSON.stringify({ a, b });
