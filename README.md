# Counterfactual Study App

Next.js application for running a small counterfactual user study with:

- a landing page and start button
- a pre-task survey
- randomized preparation phase variants
- five counterfactual trial examples
- a post-task survey
- PostgreSQL logging for sessions, events, survey answers, and trial responses

## Run

```bash
npm install
npm run dev
```

Set `DATABASE_URL` in your environment. On Railway, add a service variable named
`DATABASE_URL` and set its value to:

```text
${{ Postgres.DATABASE_URL }}
```

The dev server starts on `http://localhost:3000` by default. In the current local
environment it may fall back to `http://localhost:3001` if port `3000` is already in use.

To force a preparation condition while testing, open the landing page with:

```text
/?condition=dashboard
```

or:

```text
/?condition=text
```

## Downloading data

Set an `EXPORT_TOKEN` environment variable on the service, then you can download:

```text
/api/export/json?token=YOUR_EXPORT_TOKEN
```

The JSON export includes `sessions`, `surveyResponses`, `trialResponses`, and `events`.

## Database

The application stores all study data in PostgreSQL using the `DATABASE_URL`
environment variable. On Railway, that should point at your attached Postgres
service via `${{ Postgres.DATABASE_URL }}`.

## Main flow

1. Landing page
2. Pre-task interview
3. Preparation page
4. Five trial pages
5. Post-task survey
6. Completion page
