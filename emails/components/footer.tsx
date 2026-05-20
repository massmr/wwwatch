import { Section, Text, Link, Hr } from '@react-email/components';

import { C_MUTED, C_ACCENT, C_BORDER } from '../tokens';

type FooterProps = {
  unsubscribeUrl: string;
};

export function Footer({ unsubscribeUrl }: FooterProps) {
  return (
    <>
      <Hr style={{ borderColor: C_BORDER, margin: '32px 0 20px' }} />
      <Section>
        <Text
          style={{
            fontSize: '12px',
            color: C_MUTED,
            margin: '0',
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
          }}
        >
          wwwatch — veille IA hebdo pour product engineers.{' '}
          <Link href={unsubscribeUrl} style={{ color: C_ACCENT, textDecoration: 'underline' }}>
            Se désinscrire
          </Link>
        </Text>
      </Section>
    </>
  );
}
