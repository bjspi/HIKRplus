import { sendMessage } from "../../shared/messages";
import { absoluteUrl, isTourUrl, normalizeHikrUrl } from "../../shared/url";
import { EVT_PAGINATION_DONE, beginWork, endWork } from "../pipeline-status";
import type { HikrFeature } from "../feature-types";

const PAGE_SIZE = 20;

function nextLink(root: ParentNode, baseUrl = location.href): string | undefined {
  const explicit = root.querySelector<HTMLAnchorElement>("#NextLink");
  if (explicit?.href) return absoluteUrl(explicit.getAttribute("href") ?? explicit.href, baseUrl);
  const relNext = root.querySelector<HTMLAnchorElement>('a[rel~="next"][href]');
  if (relNext?.href) return absoluteUrl(relNext.getAttribute("href") ?? relNext.href, baseUrl);

  const anchors = [...root.querySelectorAll<HTMLAnchorElement>("a[href]")];
  const labelled = anchors.find((anchor) => {
    const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim();
    return /(^|\s)(next|weiter|vor|suivant|avanti)(\s|$|[»›])|[»›]/i.test(text);
  });
  if (labelled?.href) return absoluteUrl(labelled.getAttribute("href") ?? labelled.href, baseUrl);

  const currentSkip = skipValue(new URL(baseUrl, location.href));
  const forwardAnchor = anchors.find((anchor) => {
    try {
      const href = anchor.getAttribute("href") ?? anchor.href;
      return skipValue(new URL(href, baseUrl)) > currentSkip;
    } catch {
      return false;
    }
  });
  return forwardAnchor?.href ? absoluteUrl(forwardAnchor.getAttribute("href") ?? forwardAnchor.href, baseUrl) : undefined;
}

function skipValue(url: URL): number {
  return Number(url.searchParams.get("skip") ?? "0") || 0;
}

function fallbackNextUrl(pageType: string, currentUrl: string): string | undefined {
  const url = new URL(currentUrl, location.href);
  if (pageType === "home" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return `https://www.hikr.org/tour/?skip=${PAGE_SIZE}`;
  }
  if ((pageType === "home" || pageType === "tourList") && url.pathname === "/tour/") {
    url.searchParams.set("skip", String(skipValue(url) + PAGE_SIZE));
    return url.href;
  }
  return undefined;
}

function collectTourUrls(scope: Element, baseUrl: string): string[] {
  const urls = new Set<string>();
  scope.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const absolute = absoluteUrl(anchor.getAttribute("href") ?? "", baseUrl);
    if (isTourUrl(absolute)) urls.add(normalizeHikrUrl(absolute));
  });
  return [...urls];
}

function extractResults(doc: Document, baseUrl: string): Element | undefined {
  const contentCenter = doc.querySelector("div.content-center");
  if (contentCenter && collectTourUrls(contentCenter, baseUrl).length > 0) return contentCenter;
  const main = doc.querySelector("div#contentmain_swiss");
  if (main && collectTourUrls(main, baseUrl).length > 0) return main;
  return undefined;
}

async function loadExtraPages(pageType: string, maxPages: number, log: (message: string) => void): Promise<void> {
  // Held until the whole prefetch loop ends (or fails) so the pipeline never reports
  // idle while pages are still arriving. Per-page tour URLs are dispatched inside the
  // loop, so waypoint enrichment starts as each page lands — not only at the end.
  beginWork("pagination");
  try {
  let url = nextLink(document) ?? fallbackNextUrl(pageType, location.href);
  const target = document.querySelector("div#contentmain_swiss") ?? document.body;
  console.log("[HIKR:pagination] start", { pageType, maxPages, firstUrl: url, currentHref: location.href });
  for (let page = 0; url && page < maxPages; page++) {
    const pageUrl = url;
    console.log(`[HIKR:pagination] fetching page ${page + 2}/${maxPages + 1}:`, pageUrl);
    try {
      const response = await sendMessage<{ html: string }>({ type: "FETCH_HIKR_PAGE", url: pageUrl });
      const doc = new DOMParser().parseFromString(response.html, "text/html");
      const result = extractResults(doc, pageUrl);
      if (result) {
        result.querySelectorAll("script, style, #hikr-ext-root, .hikr-ext-panel").forEach((element) => element.remove());
        const imported = [...result.children].map((child) => document.importNode(child, true));
        const container = document.createElement("div");
        container.className = "hikr-ext-extra-page";
        container.append(...imported);
        container.querySelectorAll<HTMLElement>("[align], [style]").forEach((element) => {
          if (element.getAttribute("align")?.toLowerCase() === "center") element.setAttribute("align", "left");
          if (element.style.textAlign === "center") element.style.textAlign = "left";
        });
        container.querySelectorAll(".navigator").forEach((el) => el.remove());

        // Tour-Listen-Seiten (/tour/, Regionen): erster div.content mit Breadcrumb + h2
        const headerDiv = container.querySelector<HTMLElement>("div.content");
        if (headerDiv?.querySelector("h2.title, .title")) headerDiv.remove();

        // Suchseiten (filter.php): float:right Edit-Link, h1.title, div.hr, br
        const editSpan = container.querySelector<HTMLElement>('span[style*="float:right"]');
        if (editSpan?.querySelector("a.control")) editSpan.remove();
        const h1Title = container.querySelector<HTMLElement>("h1.title");
        if (h1Title) {
          let sib = h1Title.nextElementSibling;
          while (sib && (sib.classList.contains("hr") || sib.tagName === "BR")) {
            const next = sib.nextElementSibling;
            sib.remove();
            sib = next;
          }
          h1Title.remove();
        }
        target.append(container);
        const newUrls = collectTourUrls(container, pageUrl);
        console.log(`[HIKR:pagination] page ${page + 2}: found ${newUrls.length} tour URLs, dispatching hikr:ext:tours-appended`);
        document.dispatchEvent(new CustomEvent("hikr:ext:tours-appended", { detail: { tourUrls: newUrls } }));
      } else {
        console.log(`[HIKR:pagination] page ${page + 2}: no result container found in fetched document`);
      }
      log(`Suchseite ${page + 2} geladen`);
      const nextFromLink = nextLink(doc, pageUrl);
      const nextFromFallback = fallbackNextUrl(pageType, pageUrl);
      url = nextFromLink ?? nextFromFallback;
      console.log(`[HIKR:pagination] page ${page + 2}: next URL determination`, {
        nextFromLink,
        nextFromFallback,
        chosen: url ?? "(none – stopping)"
      });
    } catch (error) {
      console.warn("HIKR pagination fetch failed", pageUrl, error);
      return;
    }
  }
  if (!url) {
    console.log("[HIKR:pagination] done: no more pages found");
  } else {
    console.log(`[HIKR:pagination] done: reached maxPages limit (${maxPages}), next would have been:`, url);
  }
  } finally {
    endWork("pagination");
    document.dispatchEvent(new CustomEvent(EVT_PAGINATION_DONE));
  }
}

export const paginationFeature: HikrFeature = {
  id: "searchPaginationLoader",
  title: "Search Pagination Loader",
  defaultEnabled: true,
  matchesPage: (context) => context.pageType === "searchResults" || context.pageType === "home",
  run({ page, settings, log }) {
    const maxPages = page.pageType === "home"
      ? Math.max(0, (settings.search.homePagesToLoad ?? 3) - 1)
      : settings.search.extraPagesToLoad;
    if (maxPages < 1 || document.body.dataset.hikrExtPaginationDone) return;
    document.body.dataset.hikrExtPaginationDone = "true";
    void loadExtraPages(page.pageType, maxPages, log);
  }
};
