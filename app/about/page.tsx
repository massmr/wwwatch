import type { Metadata } from 'next';

import styles from './page.module.scss';

export const metadata: Metadata = {
  title: 'About — wwwatch',
  description: 'What wwwatch is and how it works.',
};

const PIPELINE_STEPS = [
  { n: '1', text: 'Collect — Hacker News, GitHub releases, Hugging Face papers, Reddit, RSS' },
  { n: '2', text: 'Score — event_freshness × 0.45 + authority × 0.25 + engagement × 0.20 + keywords × 0.10' },
  { n: '3', text: 'Enrich — fetch actual source content (release notes, papers, articles)' },
  { n: '4', text: 'Write — one Sonnet call per article, constrained to fetched source material' },
  { n: '5', text: 'QA — flag short articles, missing sources, unsourced factual details' },
  { n: '6', text: 'Store — draft edition in DB, human review before publishing' },
];

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>About wwwatch</h1>

        <div className={styles.section}>
          <p className={styles['section-title']}>What it is</p>
          <div className={styles.body}>
            <p>
              wwwatch is a daily AI journal for product engineers. Every day, a pipeline
              collects what moved in AI — new model releases, framework updates, research
              papers, funding rounds, security incidents — scores it by editorial signal,
              and writes 300-500 word articles from the actual source content.
            </p>
            <p>
              No hype, no summaries of summaries. Each article cites its source and only
              reports what the source actually says. A human reviews every draft before it
              goes live.
            </p>
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles['section-title']}>The pipeline</p>
          <div className={styles.pipeline}>
            {PIPELINE_STEPS.map((s) => (
              <div key={s.n} className={styles.step}>
                <span className={styles['step-num']}>{s.n}.</span>
                <span className={styles['step-text']}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <p className={styles['section-title']}>Built by builders</p>
          <div className={styles.body}>
            <p>
              wwwatch runs on Next.js, Neon Postgres, and Claude Sonnet. The pipeline is
              a deterministic cron job — no live LLM calls in the request path. Pages are
              server-rendered from the DB. Costs are bounded and independent of traffic.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
