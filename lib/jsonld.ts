/**
 * lib/jsonld.ts — JSON-LD schema generators for structured data (PLAN_7 §3).
 * Each function returns a plain object; caller serialises with jsonLdString().
 * No React / browser dependencies.
 */

import { SITE_URL } from './site-url';
const AUTHOR_URL = `${SITE_URL}/author/wwwatch`;
// Default OG image doubles as the organisation logo until a dedicated SVG is added.
const ORG_LOGO_URL = `${SITE_URL}/opengraph-image`;

// ── Serialisation ─────────────────────────────────────────────────────────────

/**
 * JSON.stringify with </script> tag injection protection.
 * Inject the result into <script type="application/ld+json"> safely.
 */
export function jsonLdString(schema: object): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c');
}

// ── Schemas ───────────────────────────────────────────────────────────────────

type NewsArticleInput = {
  headline: string;
  description: string;
  url: string;
  ogImageUrl: string;
  datePublished: string; // YYYY-MM-DD
  category: string;
};

/** NewsArticle schema — unlocks Top Stories eligibility on Google. */
export function newsArticleSchema(a: NewsArticleInput): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    // headline must be ≤110 chars (Google requirement).
    headline: a.headline.length > 110 ? a.headline.slice(0, 109) + '\u2026' : a.headline,
    description: a.description,
    url: a.url,
    image: [a.ogImageUrl],
    datePublished: `${a.datePublished}T00:00:00+00:00`,
    // dateModified omitted — no real re-edit; a fake timestamp misleads Google.
    author: {
      '@type': 'Person',
      name: 'wwwatch',
      url: AUTHOR_URL,
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: 'wwwatch',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: ORG_LOGO_URL,
        width: 1200,
        height: 630,
      },
    },
    articleSection: a.category,
    isAccessibleForFree: true,
    inLanguage: 'en',
  };
}

type BreadcrumbItem = { name: string; url: string };

/** BreadcrumbList schema for article and edition pages. */
export function breadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** WebSite schema with SearchAction for Sitelinks Searchbox. */
export function websiteSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'wwwatch',
    url: SITE_URL,
    description:
      'A daily journal of what actually moved in AI. The models, tools, and releases that change what you build this week.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/journal?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** NewsMediaOrganization schema for the publisher entity. */
export function newsMediaOrgSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: 'wwwatch',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: ORG_LOGO_URL,
      width: 1200,
      height: 630,
    },
    // sameAs: add social profile URLs here when available.
  };
}

/** Person schema for the author page. */
export function personSchema(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'wwwatch',
    url: AUTHOR_URL,
    // image: add URL of profile photo once committed to public/.
    // sameAs: ['https://github.com/maintainer', ...] — add social profiles.
    worksFor: {
      '@type': 'NewsMediaOrganization',
      name: 'wwwatch',
      url: SITE_URL,
    },
  };
}
