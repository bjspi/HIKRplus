import type { AnnotatedPeak } from "./types";

export function buildPhotoPageUrl(photoId: string): string {
  return `https://www.hikr.org/gallery/photo${photoId}.html`;
}

export function buildPhotoThumbUrl(photoId: string): string {
  return `https://f.hikr.org/files/${photoId}s.jpg`;
}

export function buildPhotoFullUrl(photoId: string): string {
  return `https://f.hikr.org/files/${photoId}.jpg`;
}

export function parsePhotoAnnotations(html: string): AnnotatedPeak[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const peaks: AnnotatedPeak[] = [];

  for (const row of doc.querySelectorAll<HTMLTableRowElement>("#geotags_extern #geotags tr")) {
    const link = row.querySelector<HTMLAnchorElement>("td.td_like_li a");
    if (!link) continue;
    const text = link.textContent?.trim() ?? "";
    const match = text.match(/^(.+?)\s+(\d+)\s*m\.?\s*$/i);
    if (!match) continue;
    const elevation = Number(match[2]);
    if (!Number.isFinite(elevation) || elevation <= 0) continue;

    // Extract x/y from inline <script>: annotations.push({piz_id:...,x:0.123,y:0.456})
    let x: number | undefined;
    let y: number | undefined;
    const script = row.querySelector("script");
    if (script) {
      const xm = script.textContent?.match(/\bx\s*:\s*([\d.]+)/);
      const ym = script.textContent?.match(/\by\s*:\s*([\d.]+)/);
      if (xm) x = Number(xm[1]);
      if (ym) y = Number(ym[1]);
    }

    peaks.push({
      name: match[1].trim(),
      elevation,
      dirUrl: link.href || undefined,
      ...(x !== undefined ? { x } : {}),
      ...(y !== undefined ? { y } : {})
    });
  }
  return peaks;
}

export function parseGalleryPhotoIds(doc: Document): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  // Tour pages link to photo pages: /gallery/photo4258710.html?post_id=...
  for (const anchor of doc.querySelectorAll<HTMLAnchorElement>("#new_gallery .img a")) {
    const href = anchor.getAttribute("href") ?? "";
    const fromPage = href.match(/\/gallery\/photo(\d+)\.html/i);
    if (fromPage) {
      if (!seen.has(fromPage[1])) { seen.add(fromPage[1]); ids.push(fromPage[1]); }
      continue;
    }
    // Fallback: direct image link /files/4258710.jpg
    const fromFile = href.match(/\/files\/(\d+)\.jpg$/i);
    if (fromFile && !seen.has(fromFile[1])) { seen.add(fromFile[1]); ids.push(fromFile[1]); }
  }

  // Last resort: extract from thumbnail img src /files/4258710s.jpg
  if (ids.length === 0) {
    for (const img of doc.querySelectorAll<HTMLImageElement>("#new_gallery .img img")) {
      const src = img.getAttribute("src") ?? "";
      const m = src.match(/\/files\/(\d+)s\.jpg$/i);
      if (m && !seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
    }
  }
  return ids;
}
