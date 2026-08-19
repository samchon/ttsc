import slidesMetadata from "../../../build/slides-metadata.cjs";

const { readListedSlides, readSlide, readSlides } = slidesMetadata;

const localImage = (image) => {
  const url = new URL(image, "https://ttsc.dev");
  return url.origin === "https://ttsc.dev" ? url.pathname : url.href;
};

const withImagePath = (slide) => ({
  ...slide,
  imagePath: localImage(slide.image),
});

export function getSlides() {
  return readSlides().map(withImagePath);
}

export function getListedSlides() {
  return readListedSlides().map(withImagePath);
}

export function getSlide(slug) {
  const slide = readSlide(slug);
  return slide ? withImagePath(slide) : null;
}
