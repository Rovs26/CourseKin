"""Scheduling behavior for the natural-language day planner.

The parser (OpenAI) is not exercised here — these cover the deterministic
slot-fitting that places blocks around existing busy time without overlap.
"""

from app.services.planner_service import busy_from_sessions, suggest_schedule


def _block(title, duration, time_of_day="any", day="2026-06-01", kind="personal"):
    return {
        "title": title,
        "kind": kind,
        "scheduled_date": day,
        "duration_minutes": duration,
        "time_of_day": time_of_day,
        "notes": None,
    }


def test_untimed_session_stacks_from_day_start():
    sessions = [
        {"scheduled_date": "2026-06-01", "estimated_minutes": 30, "start_time": None},
        {"scheduled_date": "2026-06-01", "estimated_minutes": 45, "start_time": None},
    ]
    busy = busy_from_sessions(sessions)
    # First stacks at 08:00 (480), second right after at 08:30 (510).
    assert busy["2026-06-01"] == [(480, 510), (510, 555)]


def test_night_block_lands_in_night_window():
    out = suggest_schedule([_block("Exercise", 60, "night", kind="exercise")], {})
    assert out[0]["start_time"] == "20:00"
    assert out[0]["conflict"] is False


def test_any_block_skips_past_a_busy_interval():
    # 09:00-10:00 busy; a 180-min "any" block can't fit the 08:00-09:00 gap,
    # so it must start at 10:00.
    existing = {"2026-06-01": [(540, 600)]}
    out = suggest_schedule([_block("Study", 180, "any", kind="study")], existing)
    assert out[0]["start_time"] == "10:00"


def test_two_blocks_do_not_overlap_each_other():
    out = suggest_schedule(
        [_block("Study", 120, "any", kind="study"), _block("Read", 60, "any")],
        {},
    )
    starts = {s["title"]: s["start_time"] for s in out}
    # Study 08:00-10:00, so Read can't start before 10:00.
    assert starts["Study"] == "08:00"
    assert starts["Read"] == "10:00"


def test_unfittable_block_is_flagged_conflict():
    # Whole day 08:00-23:00 (900 min) is busy; a new block can't be placed.
    existing = {"2026-06-01": [(480, 1380)]}
    out = suggest_schedule([_block("Study", 60, "any")], existing)
    assert out[0]["start_time"] is None
    assert out[0]["conflict"] is True
