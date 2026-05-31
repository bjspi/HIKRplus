import type { HikrFeature } from "../feature-types";

interface GalleryImage {
  src: string;
  thumb: string;
  originalHref: string;
  title: string;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

// Render free text into `container`, turning any contained URLs into clickable links.
function appendLinkified(container: HTMLElement, text: string): void {
  container.textContent = "";
  URL_RE.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    let url = match[0];
    const trailing = url.match(/[).,;:!?]+$/);
    if (trailing) url = url.slice(0, url.length - trailing[0].length);
    const start = match.index;
    if (start > lastIndex) container.append(document.createTextNode(text.slice(lastIndex, start)));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.textContent = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.className = "hikr-ext-link";
    container.append(anchor);
    lastIndex = start + url.length;
    URL_RE.lastIndex = lastIndex;
  }
  if (lastIndex < text.length) container.append(document.createTextNode(text.slice(lastIndex)));
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
        <a class="hikr-ext-lightbox-photolink" href="#" target="_blank" rel="noopener noreferrer" title="Originalbild auf hikr.org öffnen">↗ Originalbild</a>
        <button class="hikr-ext-lightbox-close" type="button" title="Schließen">x</button>
      </div>
      <div class="hikr-ext-lightbox-center">
        <div class="hikr-ext-lightbox-thumbs" hidden></div>
        <div class="hikr-ext-lightbox-stage">
          <button class="hikr-ext-lightbox-nav" type="button" data-gallery-prev title="Vorheriges Bild">&#8249;</button>
          <div class="hikr-ext-lightbox-img-wrap">
            <div class="hikr-ext-lightbox-spinner" hidden></div>
            <img alt="" />
          </div>
          <button class="hikr-ext-lightbox-nav" type="button" data-gallery-next title="Nächstes Bild">&#8250;</button>
        </div>
        <div class="hikr-ext-lightbox-title"></div>
      </div>
      <div class="hikr-ext-lightbox-footer"></div>
    `;
    root.append(lightbox);
    const title = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-title")!;
    const footer = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-footer")!;
    const target = lightbox.querySelector("img")!;
    const spinner = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-spinner")!;
    const photoLink = lightbox.querySelector<HTMLAnchorElement>(".hikr-ext-lightbox-photolink")!;
    const thumbsBar = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-thumbs")!;
    const imgWrap = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-img-wrap")!;

    let currentIndex = 0;
    const showImage = () => {
      spinner.hidden = true;
      target.style.visibility = "visible";
      imgWrap.style.minHeight = "";
    };

    // A short thumbnail strip centred on the current image, so the user can jump
    // directly instead of clicking through with the arrows.
    const renderThumbs = () => {
      const n = images.length;
      thumbsBar.textContent = "";
      if (n <= 1) { thumbsBar.hidden = true; return; }
      thumbsBar.hidden = false;
      const windowSize = Math.min(9, n);
      let start = currentIndex - Math.floor(windowSize / 2);
      start = Math.max(0, Math.min(start, n - windowSize));
      for (let i = start; i < start + windowSize; i++) {
        const thumb = document.createElement("img");
        thumb.src = images[i].thumb;
        thumb.loading = "lazy";
        thumb.alt = "";
        if (i === currentIndex) thumb.className = "is-active";
        thumb.addEventListener("click", () => openAt(i));
        thumbsBar.append(thumb);
      }
    };

    const openAt = (index: number) => {
      if (images.length === 0) return;
      currentIndex = (index + images.length) % images.length;
      const image = images[currentIndex];

      // Slow-network UX: hide the previous image and show a spinner until the new
      // one has loaded. Reserve the previous image's rendered height on the wrapper
      // so the title and thumbnail bar don't collapse inward during the load gap.
      const prevHeight = target.offsetHeight;
      if (prevHeight > 1) imgWrap.style.minHeight = `${prevHeight}px`;
      spinner.hidden = false;
      target.style.visibility = "hidden";
      target.onload = showImage;
      target.onerror = showImage;
      target.src = image.src;
      if (target.complete && target.naturalWidth > 0) showImage();

      appendLinkified(title, image.title || image.originalHref);
      photoLink.href = image.originalHref;
      footer.textContent = `${currentIndex + 1} / ${images.length} - Pfeiltasten/Thumbnails zum Wechseln, Esc zum Schließen, Ctrl+Click öffnet die klassische Ansicht`;
      renderThumbs();
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
      const thumb = image.src;
      const large = image.src.replace(/s(\.[a-z]+)$/i, "$1").replace("s.", ".");
      images.push({
        src: large,
        thumb,
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
