import styles from './page.module.scss';
import { SubscribeForm } from './SubscribeForm';

export default function Page() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          <span>DAILY JOURNAL · FREE</span>
        </div>

        <h1 className={styles.title}>
          AI intel for <em>product engineers</em>.
        </h1>

        <p className={styles.subtitle}>
          One brief a week, Monday morning. Curated by a product engineer
          for product engineers. No hype, no business porn —
          just what actually changed your stack this week.
        </p>

        <SubscribeForm />

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles['card-title']}>Models</div>
            <p className={styles['card-body']}>Anthropic, OpenAI, Google, open-source releases.</p>
          </div>
          <div className={styles.card}>
            <div className={styles['card-title']}>Tools</div>
            <p className={styles['card-body']}>Frameworks, APIs, GitHub repos taking off.</p>
          </div>
          <div className={styles.card}>
            <div className={styles['card-title']}>Papers</div>
            <p className={styles['card-body']}>Top picks from Hugging Face Daily + arXiv.</p>
          </div>
        </div>

        <footer className={styles.footer}>
          No ads. One-click unsubscribe.
        </footer>
      </div>
    </main>
  );
}
