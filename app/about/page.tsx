import type { Metadata } from 'next';

import { jsonLdString, newsMediaOrgSchema, personSchema } from '@/lib/jsonld';
import { SITE_URL } from '@/lib/site-url';

import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'About wwwatch · the daily AI brief for builders',
  description:
    'Why wwwatch exists, who builds it, and how the pipeline works. A daily journal of what moved in AI, written from the source, reviewed by a human, no hype.',
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: {
    title: 'About wwwatch · the daily AI brief for builders',
    description:
      'Why wwwatch exists, who builds it, and how the pipeline works. A daily journal of what moved in AI, written from the source, reviewed by a human, no hype.',
    url: `${SITE_URL}/about`,
  },
};

const PIPELINE_STEPS = [
  { n: '1', label: 'Collect.', desc: 'Hacker News, GitHub releases, Hugging Face papers, Reddit, official RSS.' },
  { n: '2', label: 'Score.', desc: 'Event freshness first, then source authority, engagement, and relevance. New beats merely popular.' },
  { n: '3', label: 'Enrich.', desc: 'Fetch the real source content, not just a headline.' },
  { n: '4', label: 'Write.', desc: 'One Claude Sonnet pass per article, constrained to the fetched material. No filling in from memory.' },
  { n: '5', label: 'Review.', desc: 'Every draft is checked for unsourced claims and short or generic copy, then signed off by a human.' },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(newsMediaOrgSchema()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personSchema()) }} />

      <div className={styles.container}>
        <h1 className={styles.title}>About wwwatch</h1>

        <div className={styles.section}>
          <p className={styles['section-title']}>Why this exists</p>
          <div className={styles.body}>
            <p>
              The AI stack moves too fast to follow. New model releases, framework updates,
              pricing changes, a tool that&apos;s suddenly the one everyone uses. Staying current
              meant two hours a day across Hacker News, Reddit, X, and a dozen newsletters.
              Time better spent shipping.
            </p>
            <p>
              So the watch got automated. wwwatch is that watch, made public. Every morning it
              surfaces what actually moved, and what it means for someone who has to build with it.
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles['section-title']}>What it is</p>
          <div className={styles.body}>
            <p>
              A daily journal, filtered by one question: does this change what you&apos;d build
              this week? If yes, it&apos;s in. If it&apos;s hype, an opinion piece, or a funding
              round with no product consequence, it&apos;s out.
            </p>
            <p>
              No summaries of summaries. Every article is written from the actual source — a
              release note, a paper, a changelog. It cites that source and reports only what the
              source says. When something is unknown, the article says so instead of guessing.
              And every edition is read by a human before it goes live. Up to 6 to 8 articles per
              day, no more — that&apos;s the editorial commitment.
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles['section-title']}>How it works</p>
          <div className={styles.pipeline}>
            {PIPELINE_STEPS.map((s) => (
              <div key={s.n} className={styles.step}>
                <span className={styles['step-num']}>{s.n}.</span>
                <span className={styles['step-text']}>
                  <em>{s.label}</em>{' '}{s.desc}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles['section-title']}>Built deliberately boring</p>
          <div className={styles.body}>
            <p>
              Here&apos;s the part worth saying out loud: wwwatch tracks the agentic ecosystem
              with a system that is deliberately not agentic. No swarm of autonomous agents, no
              model deciding the next step in a loop. Just a predictable cron and a handful of
              constrained model calls.
            </p>
            <p>
              That&apos;s the point. Knowing this space well enough to build in it also means
              knowing when not to reach for the fancy thing. Boring is reliable, cheap, and
              honest. Exactly what a daily brief should be.
            </p>
            <p>Built by builders, for builders.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
