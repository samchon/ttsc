import Link from "next/link";

import { getListedSlides } from "./get-slides";

export default function SlidesPage() {
  const slides = getListedSlides();

  return (
    <section className="ttsc-slides-page">
      <div className="ttsc-slides-heading">
        <p className="ttsc-slides-eyebrow">Presentations</p>
        <h1>ttsc Slides</h1>
        <p>
          Talks about compiler-powered tooling for TypeScript and coding agents.
          Open a deck and use the arrow keys, swipe, or the on-screen controls
          to navigate.
        </p>
      </div>
      <div className="ttsc-slides-grid">
        {slides.map((slide) => (
          <Link key={slide.slug} href={slide.route} className="ttsc-slide-card">
            <img
              src={slide.imagePath}
              alt=""
              className="ttsc-slide-card-image"
            />
            <div className="ttsc-slide-card-body">
              <h2>{slide.title}</h2>
              <p>{slide.description}</p>
              <span className="ttsc-slide-card-action">
                Open presentation <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
