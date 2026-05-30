import type { HikrFeature } from "../feature-types";

interface GalleryImage {
  src: string;
  originalHref: string;
  title: string;
}

export const galleryLightboxFeature: HikrFeature = {
  id: "galleryLightbox",
  title: "Gallery Lightbox",
  defaultEnabled: true,
  matchesPage: (context) => context.hasGallery,
  run({ root }) {
    if (root.querySelector(".hikr-ext-lightbox")) return;
    const images: GalleryImage[] = [];
    const lightbox = document.createElement("div");
    lightbox.className = "hikr-ext-lightbox";
    lightbox.innerHTML = `
      <div class="hikr-ext-lightbox-bar">
        <button class="hikr-ext-lightbox-close" type="button" title="Schließen">x</button>
      </div>
      <div class="hikr-ext-lightbox-stage">
        <button class="hikr-ext-lightbox-nav" type="button" data-gallery-prev title="Vorheriges Bild">&#8249;</button>
        <img alt="" />
        <button class="hikr-ext-lightbox-nav" type="button" data-gallery-next title="Nächstes Bild">&#8250;</button>
      </div>
      <div class="hikr-ext-lightbox-title"></div>
      <div class="hikr-ext-lightbox-footer"></div>
    `;
    root.append(lightbox);
    const title = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-title")!;
    const footer = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-footer")!;
    const target = lightbox.querySelector("img")!;

    let currentIndex = 0;
    const openAt = (index: number) => {
      if (images.length === 0) return;
      currentIndex = (index + images.length) % images.length;
      const image = images[currentIndex];
      target.src = image.src;
      title.textContent = image.title || image.originalHref;
      footer.textContent = `${currentIndex + 1} / ${images.length} - Pfeiltasten zum Zappen, Esc zum Schließen, Ctrl+Click öffnet die klassische Ansicht`;
      lightbox.dataset.open = "true";
    };
    const close = () => {
      lightbox.dataset.open = "false";
      target.removeAttribute("src");
    };
    const next = () => openAt(currentIndex + 1);
    const previous = () => openAt(currentIndex - 1);

    lightbox.querySelector(".hikr-ext-lightbox-close")?.addEventListener("click", close);
    lightbox.querySelector("[data-gallery-next]")?.addEventListener("click", next);
    lightbox.querySelector("[data-gallery-prev]")?.addEventListener("click", previous);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", (event) => {
      if (lightbox.dataset.open !== "true") return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    });

    document.querySelectorAll<HTMLImageElement>("#new_gallery img").forEach((image, index) => {
      const link = image.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      const originalHref = link.href;
      const large = image.src.replace(/s(\.[a-z]+)$/i, "$1").replace("s.", ".");
      images.push({
        src: large,
        originalHref,
        title: image.title || image.alt || link.title || ""
      });
      link.href = large;
      link.addEventListener("click", (event) => {
        if (event.ctrlKey) {
          location.href = originalHref;
          return;
        }
        event.preventDefault();
        openAt(index);
      });
    });
  }
};
