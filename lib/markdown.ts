import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Parses markdown to sanitised HTML safe for dangerouslySetInnerHTML.
 *
 * LLM output is untrusted — never render without this step.
 * See CONVENTIONS §Appels LLM and §Pages journal.
 */
export function parseMarkdown(md: string): string {
  // marked.parse() is sync when no async extensions are registered.
  const rawHtml = marked.parse(md) as string;

  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'ul', 'ol', 'li', 'blockquote',
      'pre', 'code', 'hr', 'br',
      'a', 'strong', 'em', 'b', 'i', 'del',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      code: ['class'],
      pre: ['class'],
      td: ['align'],
      th: ['align'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Force all links to open in new tab with security attributes.
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
  });
}
