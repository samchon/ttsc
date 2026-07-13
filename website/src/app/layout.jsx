import Script from "next/script";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";

import "./global.css";

export const metadata = {
  metadataBase: new URL("https://ttsc.dev"),
  title: {
    default: "ttsc — TypeScript-Go toolchain for compiler-powered plugins",
    template: "%s · ttsc",
  },
  description:
    "A typescript-go toolchain for compiler-powered plugins and type-safe execution.",
};

const navbar = (
  <Navbar
    logo={<span style={{ fontWeight: 700 }}>ttsc</span>}
    projectLink="https://github.com/samchon/ttsc"
  />
);

const footer = (
  <Footer>
    <span className="text-xs text-neutral-500">
      MIT 2026 ·{" "}
      <a href="https://github.com/samchon" className="hover:text-white">
        Jeongho Nam
      </a>
    </span>
  </Footer>
);

const description =
  "A typescript-go toolchain for compiler-powered plugins and type-safe execution.";

const clarityScript = `
(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "xgfyndrsk9");
`;

export default async function RootLayout(props) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        {/* FEEDS */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title="ttsc Blog RSS"
          href="/blog/rss.xml"
        />
        {/* ICONS */}
        <link rel="manifest" href="/favicon/site.webmanifest" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="theme-color" content="#0a0a0a" />
        {/* OG */}
        <meta name="og:type" content="website" />
        <meta name="og:site_name" content="ttsc" />
        <meta name="og:url" content="https://ttsc.dev" />
        <meta name="og:image" content="https://ttsc.dev/og.jpg" />
        <meta name="og:title" content="ttsc — TypeScript-Go toolchain" />
        <meta name="og:description" content={description} />
        {/* TWITTER */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@SamchonGithub" />
        <meta name="twitter:image" content="https://ttsc.dev/og.jpg" />
        <meta name="twitter:title" content="ttsc — TypeScript-Go toolchain" />
        <meta name="twitter:description" content={description} />
        {process.env.NODE_ENV === "production" ? (
          <Script id="microsoft-clarity" type="text/javascript">
            {clarityScript}
          </Script>
        ) : null}
      </Head>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/samchon/ttsc/tree/master/website"
          sidebar={{ autoCollapse: false, defaultMenuCollapseLevel: 1 }}
          nextThemes={{
            defaultTheme: "dark",
          }}
          darkMode={false}
          footer={footer}
        >
          {props.children}
        </Layout>
      </body>
    </html>
  );
}
