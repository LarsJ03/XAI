#!/usr/bin/env python3
"""Analyze study-app SQLite records and compare study conditions.

This script is intentionally dependency-light so it can run with the
standard Python library only.
"""

from __future__ import annotations

import argparse
import csv
import itertools
import json
import math
import random
import sqlite3
import statistics
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence


SCRIPT_DIR = Path(__file__).resolve().parent
APP_DIR = SCRIPT_DIR.parent
DEFAULT_DB_PATH = APP_DIR / "data" / "study.sqlite"
DEFAULT_OUTPUT_DIR = APP_DIR / "data" / "analysis"

PRETASK_LIKERT_IDS = [
    "xai_familiarity",
    "model_evaluation_experience",
    "data_science_confidence",
    "comparison_confidence",
]

POSTTASK_LIKERT_IDS = [
    "understood_counterfactual",
    "understood_method_differences",
    "felt_plausible",
    "felt_interpretable",
    "felt_confident",
    "compare_more_confidently",
    "information_manageable",
    "format_easy",
]

OPEN_TEXT_IDS = [
    "good_explanation",
    "needed_information",
    "helped_most",
    "missing_or_unclear",
    "dashboard_helped_most",
    "dashboard_remove_or_add",
]

METHODS = ["PIECE", "Min-Edit", "C-Min-Edit", "alibi-Proto-CF", "alibi-CF"]


@dataclass
class ConditionComparison:
    metric: str
    n_dashboard: int
    n_text: int
    mean_dashboard: Optional[float]
    mean_text: Optional[float]
    median_dashboard: Optional[float]
    median_text: Optional[float]
    diff_dashboard_minus_text: Optional[float]
    p_value: Optional[float]
    test_method: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze participant responses from the study-app SQLite database."
    )
    parser.add_argument(
        "--db",
        type=Path,
        default=DEFAULT_DB_PATH,
        help=f"Path to the SQLite database (default: {DEFAULT_DB_PATH})",
    )
    parser.add_argument(
        "--outdir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for CSV outputs (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--include-incomplete",
        action="store_true",
        help="Include incomplete sessions in condition comparisons.",
    )
    parser.add_argument(
        "--permutations",
        type=int,
        default=20000,
        help="Monte Carlo permutations when an exact test would be too large.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for permutation tests.",
    )
    return parser.parse_args()


def load_rows(connection: sqlite3.Connection, query: str) -> List[sqlite3.Row]:
    return list(connection.execute(query))


def parse_iso(timestamp: Optional[str]) -> Optional[datetime]:
    if not timestamp:
        return None
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def safe_mean(values: Sequence[Optional[float]]) -> Optional[float]:
    clean = [value for value in values if value is not None]
    if not clean:
        return None
    return sum(clean) / len(clean)


def safe_median(values: Sequence[Optional[float]]) -> Optional[float]:
    clean = [value for value in values if value is not None]
    if not clean:
        return None
    return statistics.median(clean)


def parse_metadata(raw_metadata: Optional[str]) -> Dict[str, object]:
    if not raw_metadata:
        return {}
    try:
        return json.loads(raw_metadata)
    except json.JSONDecodeError:
        return {}


def load_database(db_path: Path):
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row

    sessions = load_rows(connection, "SELECT * FROM sessions ORDER BY started_at ASC")
    survey_responses = load_rows(
        connection,
        """
        SELECT session_id, survey_type, question_id, likert_value, text_value, created_at, time_spent_ms
        FROM survey_responses
        ORDER BY session_id, survey_type, question_id
        """,
    )
    trial_responses = load_rows(
        connection,
        """
        SELECT session_id, trial_index, trial_id, selected_method, confidence, time_spent_ms, submitted_at, answer_payload
        FROM trial_responses
        ORDER BY session_id, trial_index
        """,
    )
    events = load_rows(
        connection,
        """
        SELECT session_id, type, created_at, payload
        FROM events
        ORDER BY session_id, created_at
        """,
    )
    connection.close()
    return sessions, survey_responses, trial_responses, events


def build_survey_maps(survey_rows: Iterable[sqlite3.Row]):
    survey_answers = defaultdict(lambda: defaultdict(dict))
    survey_times = defaultdict(lambda: defaultdict(list))

    for row in survey_rows:
        value = row["likert_value"] if row["likert_value"] is not None else row["text_value"]
        survey_answers[row["session_id"]][row["survey_type"]][row["question_id"]] = value
        survey_times[row["session_id"]][row["survey_type"]].append(row["time_spent_ms"])

    return survey_answers, survey_times


def build_trial_map(trial_rows: Iterable[sqlite3.Row]):
    trial_map = defaultdict(list)
    for row in trial_rows:
        payload = None
        if row["answer_payload"]:
            try:
                payload = json.loads(row["answer_payload"])
            except json.JSONDecodeError:
                payload = None
        trial_map[row["session_id"]].append(
            {
                "trial_index": row["trial_index"],
                "trial_id": row["trial_id"],
                "selected_method": row["selected_method"],
                "confidence": row["confidence"],
                "time_spent_ms": row["time_spent_ms"],
                "submitted_at": row["submitted_at"],
                "answer_payload": payload,
            }
        )
    return trial_map


def build_event_map(event_rows: Iterable[sqlite3.Row]):
    event_map = defaultdict(list)
    for row in event_rows:
        payload = {}
        if row["payload"]:
            try:
                payload = json.loads(row["payload"])
            except json.JSONDecodeError:
                payload = {}
        event_map[row["session_id"]].append(
            {
                "type": row["type"],
                "created_at": row["created_at"],
                "payload": payload,
            }
        )
    return event_map


def get_first_event_time_ms(events: Sequence[Dict[str, object]], event_type: str) -> Optional[int]:
    for event in events:
        if event["type"] == event_type:
            payload = event.get("payload") or {}
            time_spent_ms = payload.get("timeSpentMs")
            if isinstance(time_spent_ms, int):
                return time_spent_ms
    return None


def permutation_p_value(
    values_dashboard: Sequence[float],
    values_text: Sequence[float],
    permutations: int,
    seed: int,
) -> (Optional[float], str):
    if len(values_dashboard) < 2 or len(values_text) < 2:
        return None, "insufficient_data"

    combined = list(values_dashboard) + list(values_text)
    size_dashboard = len(values_dashboard)
    observed = abs(statistics.mean(values_dashboard) - statistics.mean(values_text))
    total_partitions = math.comb(len(combined), size_dashboard)

    if total_partitions <= 200000:
        more_extreme = 0
        for selected_indexes in itertools.combinations(range(len(combined)), size_dashboard):
            selected_indexes = set(selected_indexes)
            sample_dashboard = [combined[index] for index in range(len(combined)) if index in selected_indexes]
            sample_text = [combined[index] for index in range(len(combined)) if index not in selected_indexes]
            diff = abs(statistics.mean(sample_dashboard) - statistics.mean(sample_text))
            if diff >= observed - 1e-12:
                more_extreme += 1
        return more_extreme / total_partitions, "exact_permutation"

    rng = random.Random(seed)
    more_extreme = 0
    for _ in range(permutations):
        shuffled = combined[:]
        rng.shuffle(shuffled)
        sample_dashboard = shuffled[:size_dashboard]
        sample_text = shuffled[size_dashboard:]
        diff = abs(statistics.mean(sample_dashboard) - statistics.mean(sample_text))
        if diff >= observed - 1e-12:
            more_extreme += 1

    return (more_extreme + 1) / (permutations + 1), "monte_carlo_permutation"


def build_participant_rows(
    session_rows: Iterable[sqlite3.Row],
    survey_answers,
    survey_times,
    trial_map,
    event_map,
):
    participants = []

    for session in session_rows:
        session_id = session["id"]
        metadata = parse_metadata(session["metadata"])
        total_trials_expected = int(metadata.get("totalTrials", 0) or 0)
        pre_answers = survey_answers[session_id].get("pre-task", {})
        post_answers = survey_answers[session_id].get("post-task", {})
        trials = trial_map.get(session_id, [])
        events = event_map.get(session_id, [])

        started_at = parse_iso(session["started_at"])
        completed_at = parse_iso(session["completed_at"])
        total_duration_min = None
        if started_at and completed_at:
            total_duration_min = (completed_at - started_at).total_seconds() / 60.0

        selected_methods = [trial["selected_method"] for trial in sorted(trials, key=lambda trial: trial["trial_index"])]
        method_counts = Counter(selected_methods)
        prep_time_sec = None
        prep_time_ms = get_first_event_time_ms(events, "prep_completed")
        if prep_time_ms is not None:
            prep_time_sec = prep_time_ms / 1000.0

        pretask_mean = safe_mean([pre_answers.get(question_id) for question_id in PRETASK_LIKERT_IDS])
        posttask_mean = safe_mean([post_answers.get(question_id) for question_id in POSTTASK_LIKERT_IDS])
        mean_trial_confidence = safe_mean([trial["confidence"] for trial in trials])
        mean_trial_time_sec = safe_mean(
            [trial["time_spent_ms"] / 1000.0 for trial in trials if trial["time_spent_ms"] is not None]
        )
        total_trial_time_sec = safe_mean([])  # placeholder to keep the field type explicit below
        trial_time_values = [trial["time_spent_ms"] / 1000.0 for trial in trials if trial["time_spent_ms"] is not None]
        if trial_time_values:
            total_trial_time_sec = sum(trial_time_values)

        is_complete = bool(session["completed_at"])
        has_all_trials = total_trials_expected > 0 and len(trials) == total_trials_expected
        has_pre = bool(pre_answers)
        has_post = bool(post_answers)

        row = {
            "session_id": session_id,
            "condition": session["condition"],
            "started_at": session["started_at"],
            "completed_at": session["completed_at"],
            "current_step": session["current_step"],
            "is_complete": int(is_complete),
            "has_pre_task": int(has_pre),
            "has_post_task": int(has_post),
            "has_all_trials": int(has_all_trials),
            "total_trials_expected": total_trials_expected,
            "total_trials_answered": len(trials),
            "total_duration_min": total_duration_min,
            "prep_time_sec": prep_time_sec,
            "pre_task_time_sec": max(survey_times[session_id]["pre-task"], default=0) / 1000.0,
            "post_task_time_sec": max(survey_times[session_id]["post-task"], default=0) / 1000.0,
            "pretask_mean": pretask_mean,
            "posttask_mean": posttask_mean,
            "mean_trial_confidence": mean_trial_confidence,
            "mean_trial_time_sec": mean_trial_time_sec,
            "total_trial_time_sec": total_trial_time_sec,
            "selected_methods": "; ".join(selected_methods),
        }

        for question_id in PRETASK_LIKERT_IDS + POSTTASK_LIKERT_IDS:
            row[question_id] = pre_answers.get(question_id) if question_id in PRETASK_LIKERT_IDS else post_answers.get(question_id)

        for question_id in OPEN_TEXT_IDS:
            row[question_id] = pre_answers.get(question_id, post_answers.get(question_id))

        for method in METHODS:
            row[f"chosen_{method}"] = method_counts.get(method, 0)

        participants.append(row)

    return participants


def build_condition_comparisons(
    participant_rows: Sequence[Dict[str, object]],
    include_incomplete: bool,
    permutations: int,
    seed: int,
) -> List[ConditionComparison]:
    numeric_metrics = [
        "pretask_mean",
        "posttask_mean",
        "mean_trial_confidence",
        "mean_trial_time_sec",
        "total_trial_time_sec",
        "prep_time_sec",
        "understood_counterfactual",
        "understood_method_differences",
        "felt_plausible",
        "felt_interpretable",
        "felt_confident",
        "compare_more_confidently",
        "information_manageable",
        "format_easy",
    ]

    eligible_rows = []
    for row in participant_rows:
        if include_incomplete:
            eligible_rows.append(row)
            continue
        if row["is_complete"] and row["has_all_trials"] and row["has_post_task"]:
            eligible_rows.append(row)

    comparisons = []
    for metric in numeric_metrics:
        dashboard_values = [
            float(row[metric])
            for row in eligible_rows
            if row["condition"] == "dashboard" and row.get(metric) is not None
        ]
        text_values = [
            float(row[metric])
            for row in eligible_rows
            if row["condition"] == "text" and row.get(metric) is not None
        ]

        mean_dashboard = statistics.mean(dashboard_values) if dashboard_values else None
        mean_text = statistics.mean(text_values) if text_values else None
        median_dashboard = statistics.median(dashboard_values) if dashboard_values else None
        median_text = statistics.median(text_values) if text_values else None
        diff = None
        if mean_dashboard is not None and mean_text is not None:
            diff = mean_dashboard - mean_text

        p_value, test_method = permutation_p_value(
            dashboard_values,
            text_values,
            permutations=permutations,
            seed=seed,
        )
        comparisons.append(
            ConditionComparison(
                metric=metric,
                n_dashboard=len(dashboard_values),
                n_text=len(text_values),
                mean_dashboard=mean_dashboard,
                mean_text=mean_text,
                median_dashboard=median_dashboard,
                median_text=median_text,
                diff_dashboard_minus_text=diff,
                p_value=p_value,
                test_method=test_method,
            )
        )
    return comparisons


def build_method_choice_rows(
    participant_rows: Sequence[Dict[str, object]]
) -> List[Dict[str, object]]:
    counts = defaultdict(Counter)
    totals = Counter()

    for row in participant_rows:
        if not (row["is_complete"] and row["has_all_trials"] and row["has_post_task"]):
            continue
        totals[row["condition"]] += 1
        selected_methods = [method.strip() for method in str(row["selected_methods"]).split(";") if method.strip()]
        for method in selected_methods:
            counts[row["condition"]][method] += 1

    output_rows = []
    for condition in sorted(counts):
        for method in METHODS:
            output_rows.append(
                {
                    "condition": condition,
                    "method": method,
                    "times_selected": counts[condition].get(method, 0),
                    "participants_in_condition": totals[condition],
                }
            )
    return output_rows


def write_csv(path: Path, rows: Sequence[Dict[str, object]]):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open("w", newline="", encoding="utf-8") as handle:
            handle.write("")
        return

    fieldnames = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_comparisons_csv(path: Path, comparisons: Sequence[ConditionComparison]):
    rows = [
        {
            "metric": comparison.metric,
            "n_dashboard": comparison.n_dashboard,
            "n_text": comparison.n_text,
            "mean_dashboard": comparison.mean_dashboard,
            "mean_text": comparison.mean_text,
            "median_dashboard": comparison.median_dashboard,
            "median_text": comparison.median_text,
            "diff_dashboard_minus_text": comparison.diff_dashboard_minus_text,
            "p_value": comparison.p_value,
            "test_method": comparison.test_method,
        }
        for comparison in comparisons
    ]
    write_csv(path, rows)


def format_float(value: Optional[float], digits: int = 3) -> str:
    if value is None:
        return "n/a"
    return f"{value:.{digits}f}"


def print_report(
    participant_rows: Sequence[Dict[str, object]],
    comparisons: Sequence[ConditionComparison],
    method_choice_rows: Sequence[Dict[str, object]],
    include_incomplete: bool,
):
    complete_rows = [row for row in participant_rows if row["is_complete"]]
    eligible_rows = [
        row
        for row in participant_rows
        if include_incomplete or (row["is_complete"] and row["has_all_trials"] and row["has_post_task"])
    ]

    print("Study Analysis")
    print("=" * 80)
    print(f"Participants in database: {len(participant_rows)}")
    print(f"Completed participants: {len(complete_rows)}")
    print(f"Included in condition comparisons: {len(eligible_rows)}")
    print()

    print("Condition counts")
    print("-" * 80)
    condition_counts = Counter(row["condition"] for row in eligible_rows)
    for condition in sorted(condition_counts):
        print(f"{condition:>10}: {condition_counts[condition]}")
    print()

    print("Condition comparisons")
    print("-" * 80)
    for comparison in comparisons:
        print(
            f"{comparison.metric:>28} | "
            f"dashboard={format_float(comparison.mean_dashboard)} (n={comparison.n_dashboard}) | "
            f"text={format_float(comparison.mean_text)} (n={comparison.n_text}) | "
            f"diff={format_float(comparison.diff_dashboard_minus_text)} | "
            f"p={format_float(comparison.p_value)} [{comparison.test_method}]"
        )
    print()

    print("Method choices by condition")
    print("-" * 80)
    for row in method_choice_rows:
        print(
            f"{row['condition']:>10} | {row['method']:<14} | "
            f"selected {row['times_selected']} times across {row['participants_in_condition']} participants"
        )
    print()
    print("Note: p-values come from a two-sided permutation test on participant-level means.")


def main():
    args = parse_args()
    if not args.db.exists():
        raise SystemExit(f"Database not found: {args.db}")

    sessions, survey_responses, trial_responses, events = load_database(args.db)
    survey_answers, survey_times = build_survey_maps(survey_responses)
    trial_map = build_trial_map(trial_responses)
    event_map = build_event_map(events)

    participant_rows = build_participant_rows(
        sessions,
        survey_answers,
        survey_times,
        trial_map,
        event_map,
    )
    comparisons = build_condition_comparisons(
        participant_rows,
        include_incomplete=args.include_incomplete,
        permutations=args.permutations,
        seed=args.seed,
    )
    method_choice_rows = build_method_choice_rows(participant_rows)

    args.outdir.mkdir(parents=True, exist_ok=True)
    write_csv(args.outdir / "participant_summary.csv", participant_rows)
    write_comparisons_csv(args.outdir / "condition_comparisons.csv", comparisons)
    write_csv(args.outdir / "method_choice_counts.csv", method_choice_rows)

    print_report(
        participant_rows,
        comparisons,
        method_choice_rows,
        include_incomplete=args.include_incomplete,
    )
    print()
    print(f"CSV outputs written to: {args.outdir}")


if __name__ == "__main__":
    main()
