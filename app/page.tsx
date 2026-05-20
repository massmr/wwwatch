import styles from './page.module.scss';
import { SubscribeForm } from './SubscribeForm';

export default function Page() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          <span>NEWSLETTER HEBDO · GRATUITE</span>
        </div>

        <h1 className={styles.title}>
          La veille IA pour <em>product engineers</em>.
        </h1>

        <p className={styles.subtitle}>
          Un brief par semaine, le lundi matin. Trié par un product engineer
          pour les product engineers. Pas de hype, pas de business porn —
          juste ce qui change ta stack cette semaine.
        </p>

        <SubscribeForm />

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles['card-title']}>Modèles</div>
            <p className={styles['card-body']}>Releases Anthropic, OpenAI, Google, open source.</p>
          </div>
          <div className={styles.card}>
            <div className={styles['card-title']}>Outils</div>
            <p className={styles['card-body']}>Frameworks, APIs, repos GitHub qui décollent.</p>
          </div>
          <div className={styles.card}>
            <div className={styles['card-title']}>Papers</div>
            <p className={styles['card-body']}>Le top de Hugging Face Daily + arXiv.</p>
          </div>
        </div>

        <footer className={styles.footer}>
          Aucune pub. Désinscription en un clic.
        </footer>
      </div>
    </main>
  );
}
