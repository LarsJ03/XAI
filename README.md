# Counterfactual Study App

Next.js application for running a small counterfactual user study with:

- a landing page and start button
- a pre-task survey
- randomized `dashboard` versus `text` preparation
- five counterfactual trial examples
- a post-task survey
- SQLite logging for sessions, events, survey answers, and trial responses

## Run

```bash
npm install
npm run dev
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

## Database

The SQLite file is created automatically at:

```text
study-app/data/study.sqlite
```

## Analysis

You can analyze the saved study results with the bundled Python script:

```bash
python3 study-app/scripts/analyze_study.py
```

By default it reads `study-app/data/study.sqlite`, prints a short report to the
terminal, and writes these CSV files to `study-app/data/analysis/`:

- `participant_summary.csv`
- `condition_comparisons.csv`
- `method_choice_counts.csv`

The condition comparison uses participant-level summary metrics and a
permutation test, so it does not require external Python packages.

## Main flow

1. Landing page
2. Pre-task interview
3. Preparation page (`dashboard` or `text`)
4. Five trial pages
5. Post-task survey
6. Completion page
