import { sendMessage } from "../../shared/messages";
import { buildPhotoPageUrl, buildPhotoThumbUrl, buildPhotoFullUrl, parsePhotoAnnotations } from "../../shared/photo-annotations";
import type { AnnotatedPeak, PhotoAnnotationCache, TourCacheRecord } from "../../shared/types";
import { devLog, devWarn } from "../../shared/dev-log";
import type { HikrFeature } from "../feature-types";
import { enrichVisibleTours } from "./tour-details";

interface PeakEntry {
  peak: AnnotatedPeak;
  photos: Array<{ photoId: string; tourTitle: string; tourUrl: string }>;
}

// ── Parallelisierung ────────────────────────────────────────
const GALLERY_CONCURRENCY = 4;  // parallele Tour-/Galerie-Seitenabrufe
const PHOTO_CONCURRENCY   = 6;  // parallele Einzelfoto-Annotationsabrufe
// ────────────────────────────────────────────────────────────

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

async function fetchAnnotations(photoId: string): Promise<PhotoAnnotationCache> {
  // Check cache first (content scripts have direct chrome.storage.local access)
  const cacheKey = `hikr.photo.annotations.v2.${photoId}`;
  const stored = (await chrome.storage.local.get(cacheKey))[cacheKey] as PhotoAnnotationCache | undefined;
  if (stored?.expiresAt && stored.expiresAt > Date.now()) return stored;

  // Fetch page HTML via service worker (needs session credentials)
  const response = await sendMessage<{ html: string }>({
    type: "FETCH_HIKR_PAGE",
    url: buildPhotoPageUrl(photoId)
  });

  // Parse in content script — DOMParser works here (not in service worker)
  const peaks = parsePhotoAnnotations(response.html);

  const record: PhotoAnnotationCache = {
    photoId,
    peaks,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  await chrome.storage.local.set({ [cacheKey]: record });
  return record;
}

interface ScanResult {
  entries: PeakEntry[];
  // All peaks per photo for lightbox (ignores highestPeakOnly)
  photoAnnotations: Map<string, AnnotatedPeak[]>;
}

async function scanPhotos(
  jobs: Array<{ photoId: string; tourTitle: string; tourUrl: string }>,
  highestPeakOnly: boolean,
  onProgress: (done: number, total: number) => void
): Promise<ScanResult> {
  const peakMap = new Map<string, PeakEntry>();
  const photoAnnotations = new Map<string, AnnotatedPeak[]>();
  let done = 0;
  const queue = [...jobs];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      try {
        const result = await fetchAnnotations(job.photoId);
        // Store ALL peaks for this photo so lightbox can show every annotation
        if (result.peaks.length > 0) {
          photoAnnotations.set(job.photoId, result.peaks);
        }
        // When highestPeakOnly: only credit this photo to the highest-elevation peak in overview
        const peaks = highestPeakOnly && result.peaks.length > 1
          ? [result.peaks.reduce((a, b) => b.elevation > a.elevation ? b : a)]
          : result.peaks;
        for (const peak of peaks) {
          const key = `${peak.elevation}:${peak.name.toLowerCase()}`;
          const existing = peakMap.get(key);
          if (existing) {
            existing.photos.push({ photoId: job.photoId, tourTitle: job.tourTitle, tourUrl: job.tourUrl });
          } else {
            peakMap.set(key, { peak, photos: [{ photoId: job.photoId, tourTitle: job.tourTitle, tourUrl: job.tourUrl }] });
          }
        }
      } catch (error) {
        devWarn("snow", "photo annotation fetch failed", { photoId: job.photoId, error });
      }
      done++;
      onProgress(done, jobs.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(PHOTO_CONCURRENCY, jobs.length) }, () => worker()));
  return {
    entries: [...peakMap.values()].sort((a, b) => b.peak.elevation - a.peak.elevation),
    photoAnnotations
  };
}

function renderModal(root: HTMLElement, entries: PeakEntry[], photoAnnotations: Map<string, AnnotatedPeak[]>): void {
  root.querySelector(".hikr-ext-snow-modal")?.remove();

  const modal = document.createElement("div");
  modal.className = "hikr-ext-snow-modal";

  const noAnnotations = entries.length === 0;
  const rows = noAnnotations ? "" : entries.map((entry) => {
    const { peak, photos } = entry;
    const peakKey = `${peak.elevation}:${peak.name.toLowerCase()}`;
    const thumbs = photos.map((p) => {
      const thumb = esc(buildPhotoThumbUrl(p.photoId));
      const full = esc(buildPhotoFullUrl(p.photoId));
      return `<a class="hikr-ext-snow-thumb-link" href="${full}" target="_blank" rel="noopener noreferrer" data-photo-id="${esc(p.photoId)}" data-peak-key="${esc(peakKey)}" data-tour="${esc(p.tourTitle)}" title="${esc(p.tourTitle)}"><img src="${thumb}" alt="${esc(peak.name)}" loading="lazy" /></a>`;
    }).join("");
    const dirLink = peak.dirUrl
      ? `<a class="hikr-ext-snow-peak-name" href="${esc(peak.dirUrl)}" target="_blank" rel="noopener noreferrer">${esc(peak.name)}</a>`
      : `<span class="hikr-ext-snow-peak-name">${esc(peak.name)}</span>`;
    const tours = [...new Set(photos.map(p => p.tourTitle))];
    const tourLinks = tours.map(t => {
      const photo = photos.find(p => p.tourTitle === t);
      return photo ? `<a href="${esc(photo.tourUrl)}" target="_blank" rel="noopener noreferrer">${esc(t)}</a>` : esc(t);
    }).join(", ");
    return `<div class="hikr-ext-snow-entry">
      <div class="hikr-ext-snow-meta">
        <span class="hikr-ext-snow-elevation">▲ ${peak.elevation} m</span>
        ${dirLink}
        <span class="hikr-ext-snow-tours">${tourLinks}</span>
      </div>
      <div class="hikr-ext-snow-thumbs">${thumbs}</div>
    </div>`;
  }).join("");

  modal.innerHTML = `
    <div class="hikr-ext-snow-frame">
      <div class="hikr-ext-snow-header">
        <span>Schneelagenrecherche – ${entries.length} Punkte mit Annotationen</span>
        <div style="display:flex;gap:8px;align-items:center">
          ${entries.length > 0 ? `<button class="hikr-ext-snow-export" type="button">📥 JSON</button>` : ""}
          <button class="hikr-ext-snow-close" type="button">✕</button>
        </div>
      </div>
      <div class="hikr-ext-snow-body">
        ${noAnnotations
          ? `<p class="hikr-ext-snow-empty">Keine annotierten Bilder in den sichtbaren Touren gefunden.</p>`
          : rows}
      </div>
    </div>`;

  root.append(modal);

  modal.querySelector(".hikr-ext-snow-close")?.addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

  modal.querySelector(".hikr-ext-snow-export")?.addEventListener("click", () => {
    const data = entries.map(({ peak, photos }) => ({
      name: peak.name,
      elevation: peak.elevation,
      dirUrl: peak.dirUrl,
      photos: photos.map(p => ({
        photoId: p.photoId,
        photoUrl: buildPhotoFullUrl(p.photoId),
        thumbUrl: buildPhotoThumbUrl(p.photoId),
        tourTitle: p.tourTitle,
        tourUrl: p.tourUrl
      }))
    }));
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), peaks: data }, null, 2);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const dataUrl = `data:application/json;charset=utf-8;base64,${b64}`;
    void chrome.downloads.download({ url: dataUrl, filename: "HIKR_Schneelagen.json", saveAs: false });
  });

  // Lightbox: click on thumbnail shows full image with annotation overlay
  modal.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>(".hikr-ext-snow-thumb-link");
    if (!link) return;
    e.preventDefault();
    openSnowLightbox(modal, link, photoAnnotations);
  });
}

function openSnowLightbox(modal: HTMLElement, clickedLink: HTMLAnchorElement, photoAnnotations: Map<string, AnnotatedPeak[]>): void {
  modal.querySelector(".hikr-ext-snow-lightbox")?.remove();

  const allLinks = [...modal.querySelectorAll<HTMLAnchorElement>(".hikr-ext-snow-thumb-link")];
  let currentIndex = allLinks.indexOf(clickedLink);

  function showAt(index: number): void {
    currentIndex = (index + allLinks.length) % allLinks.length;
    const link = allLinks[currentIndex]!;
    const pid = link.dataset.photoId ?? "";
    const activePeakKey = link.dataset.peakKey ?? "";
    const photoPageUrl = `https://www.hikr.org/gallery/photo${pid}.html`;
    const tourTitle = link.dataset.tour ?? "";

    // Use all peaks for this photo so every annotation is visible in lightbox
    const peaks = photoAnnotations.get(pid) ?? [];
    const overlays = peaks.map(peak => {
      if (peak.x === undefined || peak.y === undefined) return "";
      const key = `${peak.elevation}:${peak.name.toLowerCase()}`;
      const cls = key === activePeakKey
        ? "hikr-ext-snow-annotation hikr-ext-snow-annotation--active"
        : "hikr-ext-snow-annotation";
      return `<div class="${cls}" style="left:${(peak.x * 100).toFixed(3)}%;top:${(peak.y * 100).toFixed(3)}%">${esc(peak.name)} ${peak.elevation} m</div>`;
    }).join("");

    const img = lb.querySelector<HTMLImageElement>(".hikr-ext-snow-lb-img")!;
    const annotContainer = lb.querySelector<HTMLElement>(".hikr-ext-snow-lb-annotations")!;

    // Clear while new image loads; set annotations after load so wrapper has correct size
    annotContainer.innerHTML = "";
    img.onload = () => {
      console.log(`[HIKR:annot] photo=${pid} natural=${img.naturalWidth}x${img.naturalHeight} rendered=${img.offsetWidth}x${img.offsetHeight} wrap=${img.parentElement?.offsetWidth}x${img.parentElement?.offsetHeight}`);
      peaks.forEach(p => { if (p.x !== undefined && p.y !== undefined) console.log(`[HIKR:annot]   peak="${p.name}" x=${p.x} y=${p.y} → left=${(p.x*100).toFixed(1)}% top=${(p.y*100).toFixed(1)}%`); });
      annotContainer.innerHTML = overlays;
    };
    img.src = buildPhotoFullUrl(pid);

    lb.querySelector<HTMLElement>(".hikr-ext-snow-lb-caption")!.textContent = tourTitle;
    lb.querySelector<HTMLElement>(".hikr-ext-snow-lb-counter")!.textContent = `${currentIndex + 1} / ${allLinks.length}`;
    lb.querySelector<HTMLAnchorElement>(".hikr-ext-snow-lb-photolink")!.href = photoPageUrl;
  }

  const lb = document.createElement("div");
  lb.className = "hikr-ext-snow-lightbox";
  lb.innerHTML = `
    <div class="hikr-ext-snow-lb-frame">
      <div class="hikr-ext-snow-lb-bar">
        <span class="hikr-ext-snow-lb-counter"></span>
        <span class="hikr-ext-snow-lb-caption"></span>
        <a class="hikr-ext-snow-lb-photolink" href="#" target="_blank" rel="noopener noreferrer" title="Annotiertes Foto auf hikr.org öffnen">↗ Fotoseite</a>
        <button class="hikr-ext-snow-lb-close" type="button">✕</button>
      </div>
      <div class="hikr-ext-snow-lb-stage">
        <button class="hikr-ext-snow-lb-nav hikr-ext-snow-lb-prev">&#8249;</button>
        <div class="hikr-ext-snow-lb-img-wrap">
          <img class="hikr-ext-snow-lb-img" alt="" />
          <div class="hikr-ext-snow-lb-annotations"></div>
        </div>
        <button class="hikr-ext-snow-lb-nav hikr-ext-snow-lb-next">&#8250;</button>
      </div>
    </div>`;
  modal.append(lb);

  lb.querySelector(".hikr-ext-snow-lb-close")?.addEventListener("click", () => lb.remove());
  lb.querySelector(".hikr-ext-snow-lb-prev")?.addEventListener("click", () => showAt(currentIndex - 1));
  lb.querySelector(".hikr-ext-snow-lb-next")?.addEventListener("click", () => showAt(currentIndex + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.remove(); });
  document.addEventListener("keydown", function handler(e) {
    if (!lb.isConnected) { document.removeEventListener("keydown", handler); return; }
    if (e.key === "ArrowRight") showAt(currentIndex + 1);
    if (e.key === "ArrowLeft") showAt(currentIndex - 1);
    if (e.key === "Escape") lb.remove();
  });

  showAt(allLinks.indexOf(clickedLink));
}

let activeRun = 0;

async function runSnowResearch(context: Parameters<HikrFeature["run"]>[0]): Promise<void> {
  const runId = ++activeRun;
  context.log("Touren werden geladen...");

  const { tours } = await enrichVisibleTours(context.page.tourUrls, false, {
    waypointGmapsLinks: context.settings.ui.waypointGmapsLinks
  }, GALLERY_CONCURRENCY);

  if (runId !== activeRun) return;

  console.log("[HIKR:snow] tours enriched:", tours.length);
  for (const tour of tours) {
    console.log(`[HIKR:snow] tour "${tour.title ?? tour.url}" galleryPhotoIds:`, tour.galleryPhotoIds?.length ?? "undefined", tour.galleryPhotoIds?.slice(0, 3));
  }

  const jobs: Array<{ photoId: string; tourTitle: string; tourUrl: string }> = [];
  for (const tour of tours) {
    for (const photoId of (tour.galleryPhotoIds ?? [])) {
      jobs.push({ photoId, tourTitle: tour.title ?? tour.url, tourUrl: tour.url });
    }
  }

  devLog("snow", "jobs prepared", { tours: tours.length, photos: jobs.length });
  console.log(`[HIKR:snow] total photo jobs: ${jobs.length}`);

  if (jobs.length === 0) {
    context.log(`Keine Galerie-Bilder gefunden (${tours.length} Touren ohne galleryPhotoIds – Cache leeren und neu laden!)`);
    renderModal(context.root, [], new Map());
    return;
  }

  const highestPeakOnly = context.settings.ui.snowHighestPeakOnly ?? true;
  context.log(`Bilder werden gescannt (0/${jobs.length})...`);
  const { entries, photoAnnotations } = await scanPhotos(jobs, highestPeakOnly, (done, total) => {
    if (runId === activeRun) context.log(`Bilder werden gescannt (${done}/${total})...`);
  });

  if (runId !== activeRun) return;

  context.log(`Schneelagenrecherche: ${entries.length} Punkte`);
  renderModal(context.root, entries, photoAnnotations);
}

export const snowResearchFeature: HikrFeature = {
  id: "snowResearch",
  title: "Schneelagenrecherche",
  defaultEnabled: true,
  matchesPage: (context) => context.tourUrls.length > 0 && context.pageType === "searchResults",
  run(context) {
    document.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-hikr-action="snow"]');
      if (!button) return;
      void runSnowResearch(context);
    });
  }
};
