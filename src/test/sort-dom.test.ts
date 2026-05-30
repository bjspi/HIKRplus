import { beforeEach, describe, expect, it } from "vitest";
import { sortCards, writeCardGrades } from "../content/sort-data";

function card(text: string, attrs: Record<string, string>): HTMLElement {
  const el = document.createElement("div");
  el.className = "content-list";
  el.textContent = text;
  for (const [k, v] of Object.entries(attrs)) el.dataset[k] = v;
  return el;
}

function footer(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "author-footer";
  el.style.cssText = "clear:both";
  el.textContent = text;
  return el;
}

function badge(bg: string, text: string): HTMLElement {
  const el = document.createElement("span");
  el.setAttribute("style", `width:30px;background-color:${bg};color:#FFF;padding:0px 3px;`);
  el.textContent = text;
  return el;
}

function cardTexts(): string[] {
  return [...document.querySelectorAll<HTMLElement>(".content-list")].map((c) => c.firstChild?.textContent ?? "");
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("sortCards", () => {
  function buildList(): void {
    const main = document.createElement("div");
    main.id = "contentmain_swiss";
    const center = document.createElement("div");
    center.className = "content-center";
    const h1 = document.createElement("h1");
    h1.className = "title";
    h1.textContent = "Ergebnisse";
    const script = document.createElement("script");
    script.textContent = "void 0;";
    center.append(
      h1,
      card("A", { hikrAscent: "300" }), footer("fA"),
      card("B", { hikrAscent: "100" }), footer("fB"),
      script
    );
    // Second pagination page lands in its own wrapper, like the real loader does.
    const extra = document.createElement("div");
    extra.className = "hikr-ext-extra-page";
    extra.append(card("C", { hikrAscent: "200" }), footer("fC"));
    main.append(center, extra);
    document.body.append(main);
  }

  it("orders cards ascending and merges pagination pages into one container", () => {
    buildList();
    sortCards("hikrAscent", "asc");
    expect(cardTexts()).toEqual(["B", "C", "A"]);
    // All cards end up under content-center; the empty extra-page wrapper is dropped.
    expect(document.querySelector(".hikr-ext-extra-page")).toBeNull();
    const center = document.querySelector(".content-center")!;
    expect(center.querySelectorAll(".content-list")).toHaveLength(3);
  });

  it("orders cards descending", () => {
    buildList();
    sortCards("hikrAscent", "desc");
    expect(cardTexts()).toEqual(["A", "C", "B"]);
  });

  it("keeps each card paired with its author footer after sorting", () => {
    buildList();
    sortCards("hikrAscent", "asc");
    for (const c of document.querySelectorAll<HTMLElement>(".content-list")) {
      const next = c.nextElementSibling as HTMLElement | null;
      expect(next?.classList.contains("author-footer")).toBe(true);
      expect(next?.textContent).toBe(`f${c.firstChild?.textContent}`);
    }
  });

  it("sorts cards with missing values to the end in both directions", () => {
    const main = document.createElement("div");
    const center = document.createElement("div");
    center.className = "content-center";
    center.append(
      card("A", { hikrAscent: "300" }), footer("fA"),
      card("X", {}), footer("fX"), // no value
      card("B", { hikrAscent: "100" }), footer("fB")
    );
    main.append(center);
    document.body.append(main);

    sortCards("hikrAscent", "asc");
    expect(cardTexts()).toEqual(["B", "A", "X"]);
    sortCards("hikrAscent", "desc");
    expect(cardTexts()).toEqual(["A", "B", "X"]);
  });

  it("preserves the page header and is a no-op for a single card", () => {
    const center = document.createElement("div");
    center.className = "content-center";
    center.append(card("solo", { hikrAscent: "5" }), footer("fS"));
    document.body.append(center);
    sortCards("hikrAscent", "asc");
    expect(cardTexts()).toEqual(["solo"]);
  });
});

describe("writeCardGrades", () => {
  it("extracts hiking and climbing grades from the list badges, ignoring MTB", () => {
    const c = card("tour", {});
    c.append(
      badge("#339933", " T5+"),  // hiking
      badge("#ff9c00", " II"),   // climbing
      badge("#555555", " L")     // mountainbike – must be ignored
    );
    document.body.append(c);
    writeCardGrades(c);
    expect(Number(c.dataset.hikrGradeHike)).toBeCloseTo(5.3);
    expect(Number(c.dataset.hikrGradeClimb)).toBe(2);
  });

  it("leaves attributes unset when a grade badge is absent", () => {
    const c = card("tour", {});
    c.append(badge("#339933", " T3"));
    document.body.append(c);
    writeCardGrades(c);
    expect(Number(c.dataset.hikrGradeHike)).toBe(3);
    expect(c.dataset.hikrGradeClimb).toBeUndefined();
  });
});
