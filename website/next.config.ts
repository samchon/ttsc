import nextra from "nextra";

const withNextra = nextra({});

export default withNextra({
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
});
