import { Section, Text } from '@react-email/components';

import { C_FG, C_MUTED, C_BORDER } from '../tokens';

export function Header() {
  return (
    <Section
      style={{
        borderBottom: `1px solid ${C_BORDER}`,
        paddingBottom: '16px',
        marginBottom: '24px',
      }}
    >
      <Text
        style={{
          fontSize: '20px',
          fontWeight: '700',
          color: C_FG,
          margin: '0 0 4px',
          letterSpacing: '-0.02em',
        }}
      >
        wwwatch
      </Text>
      <Text
        style={{
          fontSize: '12px',
          color: C_MUTED,
          margin: '0',
          fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        AI intel for product engineers
      </Text>
    </Section>
  );
}
