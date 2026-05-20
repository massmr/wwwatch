import { Markdown } from '@react-email/components';

import { C_BORDER, C_QUOTE, C_CODE_BG, C_BORDER_LIGHT } from '../tokens';

type ContentProps = {
  markdown: string;
};

export function Content({ markdown }: ContentProps) {
  return (
    <Markdown
      markdownCustomStyles={{
        h2: {
          fontSize: '18px',
          fontWeight: '600',
          marginTop: '32px',
          marginBottom: '8px',
          letterSpacing: '-0.01em',
        },
        blockQuote: {
          borderLeft: `3px solid ${C_BORDER}`,
          margin: '8px 0',
          padding: '4px 0 4px 12px',
          color: C_QUOTE,
          fontSize: '14px',
        },
        codeInline: {
          background: C_CODE_BG,
          padding: '1px 5px',
          borderRadius: '3px',
          fontSize: '13px',
        },
        codeBlock: {
          background: C_CODE_BG,
          padding: '8px 12px',
          borderRadius: '3px',
          fontSize: '13px',
        },
        hr: { borderColor: C_BORDER_LIGHT, margin: '28px 0' },
      }}
    >
      {markdown}
    </Markdown>
  );
}
