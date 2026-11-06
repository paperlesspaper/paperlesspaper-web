// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import {
  cachePublicIntegrations,
  getCachedPublicIntegrations,
  getPublicIntegrationsUrl,
  mapIntegration,
  normalizePublicIntegrationsLocale,
} from "../../src/helpers/publicIntegrations";

afterEach(() => localStorage.clear());

it.each([[undefined, "en"], ["nl-BE", "nl"], ["NL_nl", "nl"], ["de", "de"]])(
  "normalizes catalogue locale %s to %s and requests English fallback",
  (input, expected) => {
    expect(normalizePublicIntegrationsLocale(input)).toBe(expected);
    const url = new URL(getPublicIntegrationsUrl(input));
    expect(url.searchParams.get("locale")).toBe(expected);
    expect(url.searchParams.get("fallback-locale")).toBe("en");
  },
);

it("keeps localized catalogue text and falls back to plugin metadata when absent", () => {
  const doc = {
    id: "immich", configUrl: "https://example.com/config.json",
    config: { name: "Immich Photos", description: "Photos from Immich" },
  };
  expect(mapIntegration(doc)).toMatchObject({
    title: "Immich Photos", description: "Photos from Immich",
  });
  expect(mapIntegration({ ...doc, title: "Immich-foto's", excerpt: "Foto's uit Immich" }))
    .toMatchObject({ title: "Immich-foto's", description: "Foto's uit Immich" });
});

it("isolates caches by language and ignores the old German-fallback cache", () => {
  const integration = mapIntegration({
    id: "test", title: "Nederlandse titel", excerpt: "Beschrijving",
    configUrl: "https://example.com/config.json",
  })!;
  localStorage.setItem("paperlesspaper.publicIntegrations:nl", JSON.stringify([integration]));
  expect(getCachedPublicIntegrations("nl")).toEqual([]);
  cachePublicIntegrations("nl-BE", [integration]);
  expect(getCachedPublicIntegrations("nl")).toEqual([integration]);
  expect(getCachedPublicIntegrations("en")).toEqual([]);
});

it.each(["xkcd", "traffic-sign-of-the-day", "train-of-the-day", "rocket-launches", "jewish-date", "fish-of-the-day", "spacecraft-of-the-day", "bird-of-the-day", "dinosaur-of-the-day", "tree-of-the-day", "seasonal-produce", "simple-calendar", "countdown-card", "your-life-in-weeks", "human-rights"])(
  "marks the confirmed release %s stable despite stale catalogue metadata",
  (slug) => {
    expect(mapIntegration({ id: slug, slug: `integrations/${slug}`, status: "alpha" })?.status).toBe("stable");
    expect(mapIntegration({ id: slug, configUrl: `https://example.com/${slug}/config.json`, status: "alpha" })?.status).toBe("alpha");
  },
);

it("requests PNG thumbnails to preserve icon transparency", () => {
  const integration = mapIntegration({
    id: "test", slug: "integrations/test", status: "beta",
    hero: { media: { thumbnailURL: "https://media.paperlesspaper.de/t/c_limit,w_480,h_480,f_auto,q_auto/paperlesspaper-website/test.png" } },
  });
  expect(integration?.iconUrl).toBe("https://media.paperlesspaper.de/t/c_limit,w_128,h_128,f_png,q_auto/paperlesspaper-website/test.png");
  expect(integration?.status).toBe("beta");
});
