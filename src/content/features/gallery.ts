import { devLog, devWarn } from "../../shared/dev-log";
import type { HikrFeature } from "../feature-types";

interface GalleryImage {
  src: string;
  thumb: string;
  originalHref: string;
  srcSource: "anchor" | "derived";
  title: string;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;
const SPINNER_DELAY_MS = 120;

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

function isLikelyImageUrl(value: string): boolean {
  try {
    return /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(new URL(value, location.href).pathname);
  } catch {
    return false;
  }
}

function deriveLargeImageSrc(image: HTMLImageElement, link: HTMLAnchorElement): Pick<GalleryImage, "src" | "srcSource"> {
  if (isLikelyImageUrl(link.href)) return { src: link.href, srcSource: "anchor" };
  const thumb = image.currentSrc || image.src;
  return {
    src: thumb.replace(/s(\.[a-z]+)$/i, "$1").replace("s.", "."),
    srcSource: "derived"
  };
}

export const galleryLightboxFeature: HikrFeature = {
  id: "galleryLightbox",
  title: "Gallery Lightbox",
  defaultEnabled: true,
  matchesPage: (context) => context.hasGallery,
  run({ root, settings }) {
    if (root.querySelector(".hikr-ext-lightbox")) return;
    const images: GalleryImage[] = [];
    const preloadCount = Math.max(0, Math.min(10, Math.round(settings.ui.galleryPreloadCount ?? 3)));
    // Cache of fully-downloaded <img> ELEMENTS keyed by src. We display the cached
    // element itself instead of re-assigning a shared img's src, so a preloaded
    // image paints from its in-memory decoded bitmap with no second request — this
    // works even when hikr.org serves the photos without a reusable HTTP cache.
    const imgCache = new Map<string, HTMLImageElement>();
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
    const spinner = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-spinner")!;
    const photoLink = lightbox.querySelector<HTMLAnchorElement>(".hikr-ext-lightbox-photolink")!;
    const thumbsBar = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-thumbs")!;
    const imgWrap = lightbox.querySelector<HTMLElement>(".hikr-ext-lightbox-img-wrap")!;

    let currentIndex = 0;
    let currentEl: HTMLImageElement | undefined;
    let displayRun = 0;
    let spinnerTimer = 0;
    const clearSpinnerTimer = () => {
      window.clearTimeout(spinnerTimer);
      spinnerTimer = 0;
    };
    const scheduleSpinner = (reason: string) => {
      clearSpinnerTimer();
      spinner.hidden = true;
      spinnerTimer = window.setTimeout(() => {
        spinner.hidden = false;
        devLog("gallery", "spinner shown", { index: currentIndex, reason });
      }, SPINNER_DELAY_MS);
    };

    // Get (or create) the cached, self-loading <img> for a source. Creating it kicks
    // off the download and pre-decode immediately; the element is retained in the
    // cache so its decoded bitmap survives until evicted and can be shown instantly.
    const imgFor = (src: string): HTMLImageElement => {
      const existing = imgCache.get(src);
      if (existing) return existing;
      const el = new Image();
      el.alt = "";
      el.decoding = "async";
      el.src = src;
      if (typeof el.decode === "function") el.decode().catch(() => undefined);
      imgCache.set(src, el);
      return el;
    };

    // Keep only a small window of decoded full-res images around the current one so
    // memory stays bounded on large galleries.
    const trimCache = () => {
      if (images.length === 0) return;
      const keep = new Set<string>();
      const span = Math.max(preloadCount, 2);
      for (let off = -2; off <= span; off++) {
        const i = ((currentIndex + off) % images.length + images.length) % images.length;
        if (images[i]?.src) keep.add(images[i].src);
      }
      for (const [src, el] of [...imgCache]) {
        if (keep.has(src) || el === currentEl) continue;
        if (el.parentElement) el.remove();
        el.removeAttribute("src");
        imgCache.delete(src);
      }
    };

    const preloadAhead = (reason: string) => {
      if (preloadCount < 1 || images.length < 2) return;
      for (let offset = 1; offset <= Math.min(preloadCount, images.length - 1); offset++) {
        const image = images[(currentIndex + offset) % images.length];
        if (image?.src) imgFor(image.src);
      }
      devLog("gallery", "preload ahead", { reason, index: currentIndex, cached: imgCache.size });
      trimCache();
    };

    // Swap the given (loaded) element in as the visible photo.
    const display = (el: HTMLImageElement) => {
      clearSpinnerTimer();
      spinner.hidden = true;
      if (currentEl && currentEl !== el && currentEl.parentElement === imgWrap) currentEl.remove();
      if (el.parentElement !== imgWrap) imgWrap.appendChild(el);
      currentEl = el;
      el.style.visibility = "visible";
      imgWrap.style.minHeight = "";
      devLog("gallery", "display ready", {
        index: currentIndex,
        src: el.currentSrc || el.src,
        naturalWidth: el.naturalWidth,
        naturalHeight: el.naturalHeight
      });
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
      const runId = ++displayRun;
      const image = images[currentIndex];
      const el = imgFor(image.src);

      // Reserve the previous photo's height so the title/thumbs don't jump while a
      // not-yet-ready image loads.
      const prevHeight = currentEl?.offsetHeight ?? 0;
      if (prevHeight > 1) imgWrap.style.minHeight = `${prevHeight}px`;

      devLog("gallery", "open", {
        index: currentIndex,
        src: image.src,
        source: image.srcSource,
        complete: el.complete,
        naturalWidth: el.naturalWidth
      });

      if (el.complete && el.naturalWidth > 0) {
        // Preloaded (or already seen) → paints instantly from memory, no spinner.
        display(el);
      } else {
        // Not ready yet: keep the previous photo visible and only overlay a spinner
        // if it stays slow. Because `el` IS the element we will show, it needs no
        // second request once it finishes loading.
        scheduleSpinner("loading");
        el.addEventListener("load", () => { if (runId === displayRun) display(el); }, { once: true });
        el.addEventListener("error", () => {
          if (runId !== displayRun) return;
          devWarn("gallery", "display image failed", { index: currentIndex, src: image.src });
          display(el);
        }, { once: true });
      }

      appendLinkified(title, image.title || image.originalHref);
      photoLink.href = image.originalHref;
      footer.textContent = `${currentIndex + 1} / ${images.length} - Pfeiltasten/Thumbnails zum Wechseln, Esc zum Schließen, Ctrl+Click öffnet die klassische Ansicht`;
      renderThumbs();
      preloadAhead("open");
      lightbox.dataset.open = "true";
    };
    const close = () => {
      displayRun++;
      clearSpinnerTimer();
      lightbox.dataset.open = "false";
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
      const large = deriveLargeImageSrc(image, link);
      images.push({
        src: large.src,
        thumb,
        originalHref,
        srcSource: large.srcSource,
        title: image.title || image.alt || link.title || ""
      });
      devLog("gallery", "image indexed", {
        index,
        src: large.src,
        source: large.srcSource,
        thumb,
        originalHref
      });
      link.href = large.src;
      link.addEventListener("click", (event) => {
        if (event.ctrlKey) {
          location.href = originalHref;
          return;
        }
        event.preventDefault();
        openAt(index);
      });
    });
    devLog("gallery", "initialized", { images: images.length, preloadCount });
  }
};
