import { Html, Head, Body, Container, Preview } from '@react-email/components';

import { C_BG, C_FG } from './tokens';
import { Header } from './components/header';
import { Content } from './components/content';
import { Footer } from './components/footer';

type WeeklyBriefProps = {
  markdown: string;
  unsubscribeUrl: string;
  previewText: string;
};

export function WeeklyBrief({ markdown, unsubscribeUrl, previewText }: WeeklyBriefProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          backgroundColor: C_BG,
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif',
          color: C_FG,
          lineHeight: '1.55',
        }}
      >
        <Container
          style={{
            maxWidth: '600px',
            margin: '0 auto',
            padding: '32px 24px',
          }}
        >
          <Header />
          <Content markdown={markdown} />
          <Footer unsubscribeUrl={unsubscribeUrl} />
        </Container>
      </Body>
    </Html>
  );
}
