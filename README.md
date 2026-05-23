# wwwatch

A daily journal of what actually moved in AI. The models, tools, and
releases that change what you build this week. Sourced, no hype.

Production: https://wwwatch.dev

## How it works

```
collect  →  score  →  enrich  →  write  →  store  →  render
(scripts/daily.ts, runs once a day on a GitHub Actions cron)

then:    publish  →  trigger Vercel rebuild  →  pages serve from cache
(scripts/publish.ts, manual gate while quality is being proven)
```

The Next.js app never calls an LLM in the request path. The pipeline
writes drafts to Postgres; the web app reads them. Generation is a
deterministic flow of discrete steps — no autonomous agent loops.

Design notes live in [docs/plans/](docs/plans/).

## Stack

- [Next.js 16](https://nextjs.org) (App Router) on [Vercel](https://vercel.com)
- [Neon](https://neon.tech) (serverless Postgres) for editions, articles, raw items, subscribers
- [Anthropic Claude Sonnet](https://www.anthropic.com) for article writing, weekly intro, QA pass
- [Resend](https://resend.com) for the welcome and weekly emails
- [PostHog](https://posthog.com) (EU region) for product analytics
- GitHub Actions cron for the daily and weekly pipelines

## Local development

```bash
git clone <this-repo>
cd wwwatch
npm install
cp .env.example .env.local        # fill in the keys
npm run dev                       # http://localhost:3000
```

You need accounts on Neon, Anthropic, Resend, and PostHog (free tiers
are enough for development). The schema lives in `neon/`; apply it once
to a fresh Neon database before running the pipeline.

## Running the pipeline locally

```bash
npm run daily:dry        # collect + score + enrich + write, no DB writes
npm run weekly:dry       # build the Monday brief, print to console
npm run daily            # for real — writes drafts to Neon
npm run publish <day>    # promote drafts to published, trigger cache invalidation
```

See [docs/plans/03-daily-pipeline.md](docs/plans/03-daily-pipeline.md)
for the full pipeline contract.

## Deploy

The production deploy is on Vercel, triggered by pushes to `main`. The
pipeline runs on GitHub Actions:

- [.github/workflows/daily.yml](.github/workflows/daily.yml) — every day at 06:00 UTC
- [.github/workflows/weekly.yml](.github/workflows/weekly.yml) — every Monday at 07:00 UTC

Both consume the same env vars listed in [`.env.example`](.env.example).

## Contributing

Issues and PRs are welcome. Read [CONVENTIONS.md](CONVENTIONS.md) first
— it is short and binding. The key rules:

- Next.js 16 idioms (async params, no `useEffect` for fetch, no middleware)
- CSS Modules + SCSS, no hardcoded colors or sizes
- No `any` in TypeScript, no swallowed errors, no PII in logs
- `npm run build` must pass before commit

If you use Claude Code, the project ships an opinionated reviewer in
[.claude/agents/code-reviewer.md](.claude/agents/code-reviewer.md) and a
Neon Postgres skill in [.claude/skills/](.claude/skills/).

## Security

See [SECURITY.md](SECURITY.md). Report privately via GitHub.

## License

[MIT](LICENSE).
