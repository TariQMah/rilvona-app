"""The calculations the assistant can ask for. The model never does attendance maths in its head: it calls these.

Days follow the app: 0 = Sunday, 1 = Monday ... 6 = Saturday (Sunday has no timetable).
"""

from __future__ import annotations

import difflib
import math
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Any

from .schemas import Course, Slot, StudentContext

DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
_DAY_LOOKUP = {name.lower(): i for i, name in enumerate(DAY_NAMES)}
_DAY_LOOKUP.update({name[:3].lower(): i for i, name in enumerate(DAY_NAMES)})


# ------------------------------------------------------------------ maths


def pct(attended: float, delivered: float) -> float:
    return 100.0 if delivered <= 0 else attended / delivered * 100.0


def r1(value: float) -> float:
    return round(value * 10) / 10


def can_skip(attended: int, delivered: int, minimum: float) -> int:
    """Most classes that can be missed from now while staying at or above `minimum` percent."""
    if minimum <= 0:
        return 10**6
    if delivered <= 0:
        return 0
    return max(0, math.floor(attended * 100 / minimum - delivered + 1e-9))


def must_attend(attended: int, delivered: int, minimum: float) -> int:
    """Fewest classes in a row to attend to get back to `minimum` percent."""
    if pct(attended, delivered) >= minimum - 1e-9:
        return 0
    if minimum >= 100:
        return 10**6
    return max(0, math.ceil((minimum * delivered - 100 * attended) / (100 - minimum) - 1e-9))


def status_of(course: Course) -> str:
    current = pct(course.counted, course.deliveredClasses)
    if current < course.minRequired:
        return "SHORTAGE"
    if can_skip(course.counted, course.deliveredClasses, course.minRequired) <= 1:
        return "BORDERLINE"
    return "SAFE"


# ------------------------------------------------------------------ helpers


def parse_now(value: str, timezone: str = "Asia/Kolkata") -> datetime:
    """The phone's clock (UTC or with an offset), shown in the student's own time zone."""
    moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone_of(timezone))
    return moment.astimezone(timezone_of(timezone))


def timezone_of(name: str) -> tzinfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        return IST


IST = timezone(timedelta(hours=5, minutes=30), "IST")


def day_index(now: datetime) -> int:
    return (now.weekday() + 1) % 7  # Python: Monday = 0


def to_minutes(clock: str) -> int:
    match = re.match(r"^\s*(\d{1,2}):(\d{2})", clock or "")
    if not match:
        return 0
    return int(match.group(1)) * 60 + int(match.group(2))


def clock12(clock: str) -> str:
    minutes = to_minutes(clock)
    hours, mins = divmod(minutes, 60)
    suffix = "PM" if hours >= 12 else "AM"
    return f"{(hours % 12) or 12}:{mins:02d} {suffix}"


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", (text or "").lower()).strip()


def _is_lab_name(name: str) -> bool:
    return bool(re.search(r"\b(labs?|practicals?|workshops?)\b", name or "", re.I))


def _prefer_course(matches: list[Course], query: str) -> Course | None:
    if not matches:
        return None
    if len(matches) == 1:
        return matches[0]
    want_lab = bool(re.search(r"\blab\b|practical", query))
    picked = [c for c in matches if _is_lab_name(c.courseName) == want_lab]
    return picked[0] if len(picked) == 1 else None


_KIND_WORDS = r"\b(lectures?|theory|tuts?|tutorials?|labs?|practicals?|workshops?)\b"


def find_course(courses: list[Course], query: str) -> tuple[Course | None, list[str]]:
    """Match what the student typed ("dbms", "python lab", "CSE-301") to one subject."""
    raw = _norm(query)
    q = _norm(re.sub(_KIND_WORDS, " ", query or "", flags=re.I)) or raw
    if not q or not courses:
        return None, [c.courseName for c in courses]
    for course in courses:
        if q == _norm(course.courseCode) or q == _norm(course.courseName):
            return course, []
    contains = [c for c in courses if q in _norm(c.courseName) or q in _norm(c.courseCode)]
    preferred = _prefer_course(contains, raw)
    if preferred:
        return preferred, []
    if len(contains) > 1:
        return None, [c.courseName for c in contains]
    # Initials ("dbms" for "Database Management Systems") and word overlap.
    stop = {"of", "and", "the", "for", "to", "in", "a", "an"}
    scored: list[tuple[float, Course]] = []
    for course in courses:
        words = [w for w in _norm(course.courseName).split() if w not in stop]
        initials = "".join(w[0] for w in words)
        score = 0.0
        if q == initials or (len(q) >= 3 and initials.startswith(q)):
            score = 0.9
        else:
            overlap = len(set(q.split()) & set(words))
            if overlap:
                score = 0.5 + 0.1 * overlap
            else:
                score = difflib.SequenceMatcher(None, q, _norm(course.courseName)).ratio() * 0.8
        scored.append((score, course))
    scored.sort(key=lambda item: item[0], reverse=True)
    preferred = _prefer_course([c for s, c in scored if s >= 0.55], raw)
    if preferred:
        return preferred, []
    best = scored[0]
    if best[0] >= 0.55 and (len(scored) == 1 or best[0] - scored[1][0] >= 0.1):
        return best[1], []
    return None, [c.courseName for _, c in scored[:4]]


def slot_course(courses: list[Course], slot: Slot) -> Course | None:
    for course in courses:
        if slot.courseCode and course.courseCode == slot.courseCode:
            return course
    for course in courses:
        if _norm(course.courseName) == _norm(slot.courseName):
            return course
    return None


_MONTHS = {
    name: index
    for index, full in enumerate(
        (
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ),
        start=1,
    )
    for name in (full, full[:3])
}


def _weekday_of(when: date) -> int:
    return (when.weekday() + 1) % 7  # Sunday = 0, same as the app


def parse_calendar_date(text: str, default_year: int) -> date | None:
    """'6 November', '6 Nov 2026', '2026-11-06', '6/11/2026' (day/month)."""
    raw = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", (text or "").strip().lower())
    raw = raw.replace(",", " ")
    raw = re.sub(r"\s+", " ", raw)
    match = re.fullmatch(r"(\d{4})-(\d{1,2})-(\d{1,2})", raw)
    if match:
        try:
            return date(int(match[1]), int(match[2]), int(match[3]))
        except ValueError:
            return None
    match = re.fullmatch(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", raw)
    if match:
        day, month, year = int(match[1]), int(match[2]), int(match[3])
        if year < 100:
            year += 2000
        try:
            return date(year, month, day)
        except ValueError:
            return None
    match = re.fullmatch(r"(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?", raw)
    if match and match[2] in _MONTHS:
        try:
            return date(int(match[3]) if match[3] else default_year, _MONTHS[match[2]], int(match[1]))
        except ValueError:
            return None
    match = re.fullmatch(r"([a-z]+)\s+(\d{1,2})(?:\s+(\d{4}))?", raw)
    if match and match[1] in _MONTHS:
        try:
            return date(int(match[3]) if match[3] else default_year, _MONTHS[match[1]], int(match[2]))
        except ValueError:
            return None
    return None


def resolve_day(ctx_now: datetime, text: str) -> tuple[int, date] | None:
    """A day word or a calendar date to (weekday, that date)."""
    word = (text or "today").strip().lower()
    today = ctx_now.date()
    if word in ("today", ""):
        return day_index(ctx_now), today
    if word == "tomorrow":
        d = today + timedelta(days=1)
        return (day_index(ctx_now) + 1) % 7, d
    if word == "yesterday":
        d = today - timedelta(days=1)
        return (day_index(ctx_now) - 1) % 7, d
    parsed = parse_calendar_date(word, today.year)
    if parsed:
        if parsed < today and not re.search(r"\d{4}", word):
            try:
                parsed = parsed.replace(year=today.year + 1)
            except ValueError:
                pass
        return _weekday_of(parsed), parsed
    index = _DAY_LOOKUP.get(word)
    if index is None:
        return None
    ahead = (index - day_index(ctx_now)) % 7
    return index, today + timedelta(days=ahead)


def _slot_dict(slot: Slot) -> dict[str, Any]:
    return {
        "time": f"{clock12(slot.startTime)} - {clock12(slot.endTime)}",
        "subject": slot.courseName,
        "type": slot.slotType.title(),
        "room": slot.room,
        "faculty": slot.facultyName,
    }


def _session_dict(when: date, slot: Slot) -> dict[str, Any]:
    row = _slot_dict(slot)
    row["date"] = when.isoformat()
    row["day"] = DAY_NAMES[_weekday_of(when)]
    return row


def upcoming_sessions(now: datetime, slots: list[Slot], until: date) -> list[tuple[date, Slot]]:
    """Timetable classes from now through `until` (inclusive). Today only keeps classes that have not started yet."""
    start = now.date()
    span = (until - start).days + 1
    if span <= 0:
        return []
    now_minutes = now.hour * 60 + now.minute
    by_day: dict[int, list[Slot]] = defaultdict(list)
    for slot in slots:
        by_day[slot.dayOfWeek].append(slot)
    for day_slots in by_day.values():
        day_slots.sort(key=lambda s: to_minutes(s.startTime))
    out: list[tuple[date, Slot]] = []
    for offset in range(span):
        when = start + timedelta(days=offset)
        index = _weekday_of(when)
        if index == 0:
            continue
        for slot in by_day.get(index, []):
            if offset == 0 and to_minutes(slot.startTime) <= now_minutes:
                continue
            out.append((when, slot))
    return out


def _slots_for_query(slots: list[Slot], query: str) -> list[Slot]:
    raw = _norm(query)
    if re.search(r"\blab\b|practical", raw):
        typed = [s for s in slots if re.search(r"lab|practical", s.slotType or "", re.I)]
        return typed or slots
    if re.search(r"lecture|theory|tut", raw):
        typed = [s for s in slots if not re.search(r"lab|practical", s.slotType or "", re.I)]
        return typed or slots
    return slots


def project_counts(attended: int, delivered: int, attend: int, skip: int) -> tuple[int, int, float]:
    after_a = attended + attend
    after_d = delivered + attend + skip
    return after_a, after_d, pct(after_a, after_d)


# ------------------------------------------------------------------ the toolbox


class Toolbox:
    def __init__(self, ctx: StudentContext):
        self.ctx = ctx
        self.now = parse_now(ctx.now, ctx.timezone)

    # -- attendance -------------------------------------------------------

    def _course_row(self, course: Course) -> dict[str, Any]:
        a, d, m = course.counted, course.deliveredClasses, course.minRequired
        return {
            "subject": course.courseName,
            "code": course.courseCode,
            "attended": course.attendedClasses,
            "duty_leave": course.dutyLeave,
            "counted_as_attended": a,
            "delivered": d,
            "percent": r1(pct(a, d)),
            "minimum_percent": m,
            "status": status_of(course),
            "can_skip": can_skip(a, d, m),
            "must_attend_in_a_row": must_attend(a, d, m),
        }

    def get_attendance(self, course: str | None = None) -> dict[str, Any]:
        courses = self.ctx.attendance
        if not courses:
            return {"error": "No attendance has been synced yet."}
        if course:
            found, options = find_course(courses, course)
            if not found:
                return {"error": f"Could not tell which subject you mean. Options: {options}"}
            row = self._course_row(found)
            row["faculty"] = found.facultyName
            row["last_lecture_at"] = found.lastLectureAt
            row["recent_classes"] = [
                {"date": h.date, "time": h.timing, "status": h.status} for h in found.history[:8]
            ]
            return row
        attended = sum(c.counted for c in courses)
        delivered = sum(c.deliveredClasses for c in courses)
        rows = [self._course_row(c) for c in courses]
        rows.sort(key=lambda r: r["percent"])
        return {
            "overall_percent": r1(pct(attended, delivered)),
            "total_attended": attended,
            "total_delivered": delivered,
            "subjects": rows,
        }

    def attendance_what_if(self, course: str, attend_next: int = 0, skip_next: int = 0) -> dict[str, Any]:
        found, options = find_course(self.ctx.attendance, course)
        if not found:
            return {"error": f"Could not tell which subject you mean. Options: {options}"}
        attend_next = max(0, min(int(attend_next or 0), 500))
        skip_next = max(0, min(int(skip_next or 0), 500))
        a = found.counted + attend_next
        d = found.deliveredClasses + attend_next + skip_next
        after = pct(a, d)
        return {
            "subject": found.courseName,
            "now_percent": r1(pct(found.counted, found.deliveredClasses)),
            "after_percent": r1(after),
            "minimum_percent": found.minRequired,
            "stays_above_minimum": after >= found.minRequired - 1e-9,
            "assumption": f"attend the next {attend_next} and skip the next {skip_next} classes of this subject",
        }

    def classes_needed(self, course: str, target_percent: float = 75) -> dict[str, Any]:
        found, options = find_course(self.ctx.attendance, course)
        if not found:
            return {"error": f"Could not tell which subject you mean. Options: {options}"}
        target = max(1.0, min(float(target_percent or 75), 100.0))
        a, d = found.counted, found.deliveredClasses
        current = pct(a, d)
        result: dict[str, Any] = {
            "subject": found.courseName,
            "now_percent": r1(current),
            "target_percent": target,
        }
        if current >= target - 1e-9:
            result["already_there"] = True
            result["can_skip_and_stay_at_target"] = can_skip(a, d, target)
        else:
            needed = must_attend(a, d, target)
            result["already_there"] = False
            result["must_attend_in_a_row"] = None if needed >= 10**6 else needed
        return result

    def skip_day_impact(self, day: str = "tomorrow") -> dict[str, Any]:
        """Planner-style: attend every class from now until that date, then skip that whole day."""
        resolved = resolve_day(self.now, day)
        if not resolved:
            return {"error": f"Do not know the day '{day}'. Use today, tomorrow, a weekday or a date such as 6 November."}
        index, when = resolved
        if when < self.now.date():
            return {"error": f"{when.isoformat()} has already passed."}
        if (when - self.now.date()).days > 180:
            return {"error": "That date is too far ahead to plan from the weekly timetable."}
        sessions = upcoming_sessions(self.now, self.ctx.timetable, when)
        before = [(d, s) for d, s in sessions if d < when]
        skipped = [(d, s) for d, s in sessions if d == when]
        if not skipped:
            return {
                "day": DAY_NAMES[index],
                "date": when.isoformat(),
                "classes": 0,
                "attended_before": len(before),
                "note": "No remaining classes that day.",
            }
        attended0 = sum(c.counted for c in self.ctx.attendance)
        delivered0 = sum(c.deliveredClasses for c in self.ctx.attendance)
        after_a, after_d, after_pct = project_counts(attended0, delivered0, len(before), len(skipped))
        by_code: dict[str, dict[str, Any]] = {}
        for d, slot in sessions:
            course = slot_course(self.ctx.attendance, slot)
            if not course:
                continue
            key = course.courseCode or course.courseName
            row = by_code.setdefault(key, {"course": course, "attend": 0, "skip": 0})
            if d == when:
                row["skip"] += 1
            else:
                row["attend"] += 1
        falls, already, subjects = [], [], []
        for row in by_code.values():
            c: Course = row["course"]
            before_pct = pct(c.counted, c.deliveredClasses)
            _a, _d, to = project_counts(c.counted, c.deliveredClasses, row["attend"], row["skip"])
            subjects.append(
                {
                    "subject": c.courseName,
                    "attended_before": row["attend"],
                    "classes_missed": row["skip"],
                    "from_percent": r1(before_pct),
                    "to_percent": r1(to),
                }
            )
            if row["skip"] <= 0:
                continue
            if before_pct < c.minRequired:
                already.append(c.courseName)
            elif to < c.minRequired - 1e-9:
                falls.append(c.courseName)
        subjects.sort(key=lambda r: r["to_percent"])
        return {
            "day": DAY_NAMES[index],
            "date": when.isoformat(),
            "classes": len(skipped),
            "attended_before": len(before),
            "overall_from_percent": r1(pct(attended0, delivered0)),
            "overall_to_percent": r1(after_pct),
            "overall_if_attend_that_day": r1(project_counts(attended0, delivered0, len(before) + len(skipped), 0)[2]),
            "change_from_today": r1(after_pct - pct(attended0, delivered0)),
            "would_drop_below_minimum": falls,
            "already_below_minimum": already,
            "subjects": [s for s in subjects if s["classes_missed"] or s["attended_before"]],
            "assumption": (
                f"from today's attendance, attend the {len(before)} class(es) between now and {when.isoformat()}, "
                f"then skip all {len(skipped)} class(es) that day"
            ),
        }

    def skip_class_impact(self, course: str, day: str = "today") -> dict[str, Any]:
        """Planner-style: attend this subject's classes from now until that date, then skip that day's class(es)."""
        found, options = find_course(self.ctx.attendance, course)
        if not found:
            return {"error": f"Could not tell which subject you mean. Options: {options}"}
        resolved = resolve_day(self.now, day)
        if not resolved:
            return {"error": f"Do not know the day '{day}'. Use today, a weekday or a date such as 6 November."}
        index, when = resolved
        if when < self.now.date():
            return {"error": f"{when.isoformat()} has already passed."}
        if (when - self.now.date()).days > 180:
            return {"error": "That date is too far ahead to plan from the weekly timetable."}
        mine = [
            slot
            for slot in self.ctx.timetable
            if slot_course(self.ctx.attendance, slot) is found
        ]
        mine = _slots_for_query(mine, course)
        weekday_slots = [s for s in mine if s.dayOfWeek == index]
        if not weekday_slots:
            return {
                "subject": found.courseName,
                "day": DAY_NAMES[index],
                "date": when.isoformat(),
                "classes": 0,
                "note": f"No {found.courseName} class on {DAY_NAMES[index]} {when.day} {when.strftime('%B')}.",
            }
        sessions = upcoming_sessions(self.now, mine, when)
        before = [(d, s) for d, s in sessions if d < when]
        skipped = [(d, s) for d, s in sessions if d == when]
        if not skipped:
            return {
                "subject": found.courseName,
                "day": DAY_NAMES[index],
                "date": when.isoformat(),
                "classes": 0,
                "attended_before": [_session_dict(d, s) for d, s in before],
                "note": f"No remaining {found.courseName} class on {DAY_NAMES[index]} {when.day} {when.strftime('%B')}.",
            }
        now_pct = pct(found.counted, found.deliveredClasses)
        after_a, after_d, after_pct = project_counts(found.counted, found.deliveredClasses, len(before), len(skipped))
        attend_all = project_counts(found.counted, found.deliveredClasses, len(before) + len(skipped), 0)[2]
        return {
            "subject": found.courseName,
            "code": found.courseCode,
            "day": DAY_NAMES[index],
            "date": when.isoformat(),
            "today_attended": found.counted,
            "today_delivered": found.deliveredClasses,
            "from_percent": r1(now_pct),
            "attended_before_count": len(before),
            "attended_before": [_session_dict(d, s) for d, s in before],
            "skipped_count": len(skipped),
            "skipped": [_session_dict(d, s) for d, s in skipped],
            "after_attended": after_a,
            "after_delivered": after_d,
            "to_percent": r1(after_pct),
            "if_attend_that_day_percent": r1(attend_all),
            "change_from_today": r1(after_pct - now_pct),
            "skip_cost_versus_attending": r1(after_pct - attend_all),
            "minimum_percent": found.minRequired,
            "stays_above_minimum": after_pct >= found.minRequired - 1e-9,
            "assumption": (
                f"from today's {found.counted}/{found.deliveredClasses}, attend the {len(before)} "
                f"{found.courseName} class(es) between now and {when.isoformat()}, then skip that day's "
                f"{len(skipped)} class(es)"
            ),
        }

    # -- timetable --------------------------------------------------------

    def get_schedule(self, day: str = "today") -> dict[str, Any]:
        if not self.ctx.timetable:
            return {"error": "No timetable has been synced yet."}
        if (day or "").strip().lower() == "week":
            week = {}
            for index in range(1, 7):
                slots = sorted(
                    (s for s in self.ctx.timetable if s.dayOfWeek == index), key=lambda s: to_minutes(s.startTime)
                )
                week[DAY_NAMES[index]] = [_slot_dict(s) for s in slots]
            return {"week": week}
        resolved = resolve_day(self.now, day)
        if not resolved:
            return {"error": f"Do not know the day '{day}'. Use today, tomorrow, a weekday or a date such as 6 November."}
        index, when = resolved
        slots = sorted(
            (s for s in self.ctx.timetable if s.dayOfWeek == index), key=lambda s: to_minutes(s.startTime)
        )
        rows = []
        minutes_now = self.now.hour * 60 + self.now.minute
        for slot in slots:
            row = _slot_dict(slot)
            if when == self.now.date():
                if to_minutes(slot.endTime) <= minutes_now:
                    row["state"] = "done"
                elif to_minutes(slot.startTime) <= minutes_now:
                    row["state"] = "running now"
                else:
                    row["state"] = "upcoming"
            rows.append(row)
        return {
            "day": DAY_NAMES[index],
            "date": when.isoformat(),
            "classes": rows,
            "note": "Sunday has no classes." if index == 0 else ("" if rows else "No classes that day."),
        }

    def next_class(self) -> dict[str, Any]:
        if not self.ctx.timetable:
            return {"error": "No timetable has been synced yet."}
        minutes_now = self.now.hour * 60 + self.now.minute
        for ahead in range(0, 8):
            when = self.now.date() + timedelta(days=ahead)
            index = (day_index(self.now) + ahead) % 7
            slots = sorted(
                (s for s in self.ctx.timetable if s.dayOfWeek == index), key=lambda s: to_minutes(s.startTime)
            )
            for slot in slots:
                if ahead == 0 and to_minutes(slot.startTime) <= minutes_now:
                    continue
                starts = datetime.combine(when, datetime.min.time(), tzinfo=self.now.tzinfo) + timedelta(
                    minutes=to_minutes(slot.startTime)
                )
                minutes_until = int((starts - self.now).total_seconds() // 60)
                result = _slot_dict(slot)
                result.update({"day": DAY_NAMES[index], "date": when.isoformat(), "starts_in_minutes": minutes_until})
                course = slot_course(self.ctx.attendance, slot)
                if course:
                    result["attendance_percent"] = r1(pct(course.counted, course.deliveredClasses))
                    result["can_skip"] = can_skip(course.counted, course.deliveredClasses, course.minRequired)
                return result
        return {"note": "No upcoming classes found in the next week."}

    # -- marks and updates ---------------------------------------------------

    def get_marks(self, course: str | None = None) -> dict[str, Any]:
        if not self.ctx.marks:
            return {"error": "No marks have been published or synced yet."}
        grouped: dict[str, list] = defaultdict(list)
        for mark in self.ctx.marks:
            grouped[mark.courseName or mark.courseCode].append(mark)
        names = list(grouped.keys())
        if course:
            q = _norm(course)
            picked = [n for n in names if q in _norm(n)]
            if not picked:
                scored = difflib.get_close_matches(q, [_norm(n) for n in names], n=1, cutoff=0.45)
                picked = [n for n in names if scored and _norm(n) == scored[0]]
            if not picked:
                return {"error": f"No marks found for '{course}'. Subjects with marks: {names}"}
            names = picked
        subjects = []
        total_pct = []
        for name in names:
            marks = grouped[name]
            obtained = sum(m.obtainedMarks for m in marks)
            maximum = sum(m.maxMarks for m in marks)
            percent = r1(obtained / maximum * 100) if maximum else None
            if percent is not None:
                total_pct.append(percent)
            subjects.append(
                {
                    "subject": name,
                    "obtained": obtained,
                    "out_of": maximum,
                    "percent": percent,
                    "assessments": [
                        {
                            "name": m.assessmentName,
                            "category": m.category.title(),
                            "obtained": m.obtainedMarks,
                            "out_of": m.maxMarks,
                        }
                        for m in marks
                    ],
                }
            )
        subjects.sort(key=lambda s: (s["percent"] is None, s["percent"] if s["percent"] is not None else 0))
        return {
            "average_percent": r1(sum(total_pct) / len(total_pct)) if total_pct else None,
            "subjects": subjects,
        }

    def get_updates(self) -> dict[str, Any]:
        alerts = sorted(self.ctx.alerts, key=lambda a: a.publishedAt, reverse=True)[:8]
        return {
            "alerts": [
                {"category": a.category.title(), "title": a.title, "details": a.body[:300], "when": a.publishedAt[:10]}
                for a in alerts
            ],
            "university_notices": [
                {"kind": n.kind.title(), "title": n.title, "details": (n.body or "")[:300], "when": n.date}
                for n in self.ctx.notices[:8]
            ],
        }

    # -- dispatch ------------------------------------------------------------

    def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        handlers = {
            "get_attendance": self.get_attendance,
            "attendance_what_if": self.attendance_what_if,
            "classes_needed": self.classes_needed,
            "skip_day_impact": self.skip_day_impact,
            "skip_class_impact": self.skip_class_impact,
            "get_schedule": self.get_schedule,
            "next_class": self.next_class,
            "get_marks": self.get_marks,
            "get_updates": self.get_updates,
        }
        handler = handlers.get(name)
        if not handler:
            return {"error": f"Unknown tool {name}."}
        try:
            return handler(**{k: v for k, v in (arguments or {}).items()})
        except TypeError as exc:
            return {"error": f"Bad arguments for {name}: {exc}"}


def _fn(name: str, description: str, properties: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required or []},
        },
    }


TOOL_SPECS: list[dict[str, Any]] = [
    _fn(
        "get_attendance",
        "Attendance of the student. Without a subject: overall percentage and every subject (lowest first) with how many "
        "classes can be skipped or must be attended. With a subject: that subject in detail incl. recent classes.",
        {"course": {"type": "string", "description": "Subject name, code or short form (e.g. 'dbms'). Optional."}},
    ),
    _fn(
        "attendance_what_if",
        "Attendance of one subject after attending and/or skipping a number of its next classes.",
        {
            "course": {"type": "string"},
            "attend_next": {"type": "integer", "description": "Next classes attended."},
            "skip_next": {"type": "integer", "description": "Next classes skipped."},
        },
        ["course"],
    ),
    _fn(
        "classes_needed",
        "How many classes in a row to attend to reach a target percentage, or how many can be skipped while staying at it.",
        {"course": {"type": "string"}, "target_percent": {"type": "number", "description": "Default 75."}},
        ["course"],
    ),
    _fn(
        "skip_day_impact",
        "Planner-style: from today's attendance, attend every class until a date, then skip that whole day. "
        "Returns today's %, classes attended in between, and the landing %.",
        {
            "day": {
                "type": "string",
                "description": "today, tomorrow, a weekday name, or a date such as '6 November' or '2026-11-06'. Default tomorrow.",
            }
        },
    ),
    _fn(
        "skip_class_impact",
        "Planner-style: from today's attendance of one subject, attend its classes until a date, then skip that day's class(es). "
        "Use this for 'what if I skip the 6 November DAA lecture'. Does not skip the whole day.",
        {
            "course": {"type": "string", "description": "Subject, e.g. 'DAA lecture' or 'PL/SQL Lab'."},
            "day": {
                "type": "string",
                "description": "today, a weekday, or a date such as '6 November'. Default today.",
            },
        },
        ["course"],
    ),
    _fn(
        "get_schedule",
        "Timetable for a day, or the whole week.",
        {
            "day": {
                "type": "string",
                "description": "today, tomorrow, yesterday, a weekday, a date such as '6 November', or 'week'.",
            }
        },
    ),
    _fn("next_class", "The next class that starts, with room, faculty and attendance for that subject.", {}),
    _fn(
        "get_marks",
        "Published marks: per subject assessments, totals and percentages, plus the average.",
        {"course": {"type": "string", "description": "Optional subject filter."}},
    ),
    _fn("get_updates", "Recent portal alerts and university notices/announcements.", {}),
]
