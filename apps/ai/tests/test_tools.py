from app.tools import Toolbox, can_skip, find_course, must_attend, pct


def test_can_skip_and_must_attend_match_the_app():
    # 41/50 = 82%: skipping k more keeps >= 75% while 41/(50+k) >= .75 -> k <= 4.67 -> 4
    assert can_skip(41, 50, 75) == 4
    assert can_skip(30, 40, 75) == 0  # exactly 75%
    assert can_skip(28, 40, 75) == 0  # below the line already
    # 28/40 = 70%: need (28+n)/(40+n) >= .75 -> n >= 8
    assert must_attend(28, 40, 75) == 8
    assert must_attend(30, 40, 75) == 0
    assert round(pct(41, 50), 1) == 82.0
    assert pct(0, 0) == 100.0


def test_find_course_by_short_forms(ctx):
    courses = ctx.attendance
    assert find_course(courses, "python")[0].courseCode == "CSE-101"
    assert find_course(courses, "CSE-303")[0].courseName.startswith("Advanced Database")
    assert find_course(courses, "daa")[0].courseCode == "CSE-202"
    assert find_course(courses, "pl/sql")[0].courseCode == "CSE-404"
    course, options = find_course(courses, "chemistry")
    assert course is None and options


def test_overall_attendance_lists_lowest_first(ctx):
    result = Toolbox(ctx).get_attendance()
    assert result["total_attended"] == 113 and result["total_delivered"] == 150
    assert result["overall_percent"] == 75.3
    assert result["subjects"][0]["subject"] == "Advanced Database Management System"
    assert result["subjects"][0]["status"] == "SHORTAGE"


def test_what_if_and_classes_needed(ctx):
    box = Toolbox(ctx)
    skip = box.attendance_what_if("python", skip_next=5)
    assert skip["after_percent"] == 74.5 and skip["stays_above_minimum"] is False
    assert box.attendance_what_if("python", skip_next=4)["stays_above_minimum"] is True
    need = box.classes_needed("dbms" if False else "Advanced Database", 75)
    assert need["already_there"] is False and need["must_attend_in_a_row"] == 8
    assert box.classes_needed("python", 75)["can_skip_and_stay_at_target"] == 4


def test_schedule_states_and_tomorrow(ctx):
    box = Toolbox(ctx)  # Wednesday 10:00
    today = box.get_schedule("today")
    assert today["day"] == "Wednesday"
    assert [c["state"] for c in today["classes"]] == ["running now", "upcoming"]
    tomorrow = box.get_schedule("tomorrow")
    assert tomorrow["day"] == "Thursday" and len(tomorrow["classes"]) == 2
    assert "Sunday" in box.get_schedule("sunday")["note"]
    assert set(box.get_schedule("week")["week"]) >= {"Wednesday", "Thursday"}


def test_next_class_rolls_to_the_next_start(ctx):
    nxt = Toolbox(ctx).next_class()
    assert nxt["subject"] == "Design and Analysis of Algorithms" and nxt["starts_in_minutes"] == 40


def test_skip_day_impact(ctx):
    impact = Toolbox(ctx).skip_day_impact("tomorrow")
    assert impact["classes"] == 2
    # Wednesday 10:00: today's remaining DAA lecture is attended before Thursday is skipped.
    assert impact["attended_before"] == 1
    assert "PL/SQL Lab" in impact["would_drop_below_minimum"] or "PL/SQL Lab" in impact["already_below_minimum"]
    assert impact["overall_to_percent"] < impact["overall_from_percent"]
    assert Toolbox(ctx).skip_day_impact("saturday")["classes"] == 0


def test_marks_and_updates(ctx):
    marks = Toolbox(ctx).get_marks("python")
    assert marks["subjects"][0]["obtained"] == 26 and marks["subjects"][0]["percent"] == 65.0
    assert "error" in Toolbox(ctx).get_marks("chemistry")
    assert Toolbox(ctx).get_updates()["alerts"][0]["title"] == "Lab exam"


def test_calendar_dates_and_skipping_one_class(ctx):
    from tests.conftest import make_context

    box = Toolbox(ctx)
    friday = box.get_schedule("6 November")
    assert friday["day"] == "Friday" and friday["date"] == "2026-11-06"
    assert friday["classes"] == []

    with_friday = make_context(
        attendance=[
            *[c.model_dump() for c in ctx.attendance],
            {
                "courseCode": "CSE-205",
                "courseName": "Design and Analysis of Algorithms Lab",
                "attendedClasses": 31,
                "deliveredClasses": 37,
                "minRequired": 75,
            },
        ],
        timetable=[
            *[s.model_dump() for s in ctx.timetable],
            {
                "dayOfWeek": 5,
                "startTime": "09:55",
                "endTime": "10:40",
                "courseCode": "CSE-202",
                "courseName": "Design and Analysis of Algorithms",
                "slotType": "LECTURE",
            },
            {
                "dayOfWeek": 5,
                "startTime": "11:25",
                "endTime": "12:10",
                "courseCode": "CSE-205",
                "courseName": "Design and Analysis of Algorithms Lab",
                "slotType": "LAB",
            },
        ],
    )
    courses = with_friday.attendance
    assert find_course(courses, "daa")[0].courseCode == "CSE-202"
    assert find_course(courses, "daa lab")[0].courseCode == "CSE-205"
    impact = Toolbox(with_friday).skip_class_impact("DAA lecture", "6 November")
    # From Wed 21 Oct 10:00: five DAA lectures before Fri 6 Nov, then skip that one.
    # 30/40 → attend 5 → skip 1 → 35/46 = 76.1%
    assert impact["date"] == "2026-11-06" and impact["skipped_count"] == 1
    assert impact["attended_before_count"] == 5
    assert impact["from_percent"] == 75.0 and impact["to_percent"] == 76.1
    assert impact["after_attended"] == 35 and impact["after_delivered"] == 46
    assert impact["stays_above_minimum"] is True


def test_skip_class_counts_lectures_between_today_and_the_date():
    from tests.conftest import make_context

    ctx = make_context(
        now="2026-10-28T05:55:00+05:30",
        attendance=[
            {
                "courseCode": "26CAT-611",
                "courseName": "Design and Analysis of Algorithms",
                "attendedClasses": 24,
                "deliveredClasses": 32,
                "minRequired": 75,
            },
            {
                "courseCode": "26CAP-612",
                "courseName": "Design and Analysis of Algorithms Lab",
                "attendedClasses": 31,
                "deliveredClasses": 37,
                "minRequired": 75,
            },
        ],
        timetable=[
            {"dayOfWeek": 3, "startTime": "10:40", "endTime": "11:25", "courseCode": "26CAT-611", "courseName": "Design and Analysis of Algorithms", "slotType": "LECTURE"},
            {"dayOfWeek": 4, "startTime": "13:40", "endTime": "14:25", "courseCode": "26CAT-611", "courseName": "Design and Analysis of Algorithms", "slotType": "LECTURE"},
            {"dayOfWeek": 5, "startTime": "09:55", "endTime": "10:40", "courseCode": "26CAT-611", "courseName": "Design and Analysis of Algorithms", "slotType": "LECTURE"},
            {"dayOfWeek": 5, "startTime": "11:25", "endTime": "12:10", "courseCode": "26CAP-612", "courseName": "Design and Analysis of Algorithms Lab", "slotType": "LAB"},
        ],
    )
    impact = Toolbox(ctx).skip_class_impact("DAA lecture", "6 November")
    # Wed 28, Thu 29, Fri 30, Wed 4, Thu 5 attend; Fri 6 skip → 29/38 = 76.3%
    assert [row["date"] for row in impact["attended_before"]] == [
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-11-04",
        "2026-11-05",
    ]
    assert impact["skipped"][0]["date"] == "2026-11-06"
    assert impact["from_percent"] == 75.0
    assert impact["to_percent"] == 76.3
    assert impact["if_attend_that_day_percent"] == 78.9
    assert impact["stays_above_minimum"] is True


def test_unknown_tool_and_bad_arguments_are_reported_not_raised(ctx):
    box = Toolbox(ctx)
    assert "error" in box.call("nope", {})
    assert "error" in box.call("get_schedule", {"wrong": 1})


def test_time_is_shown_in_the_students_time_zone():
    from app.tools import parse_now

    assert parse_now("2026-10-20T22:30:00.000Z", "Asia/Kolkata").strftime("%a %H:%M") == "Wed 04:00"
    assert parse_now("2026-10-20T22:30:00Z", "Not/AZone").strftime("%H:%M") == "04:00"  # falls back to India time
    assert parse_now("2026-10-21T10:00:00+05:30", "Asia/Kolkata").hour == 10


def test_duty_leave_counts_as_attended():
    from tests.conftest import make_context

    ctx = make_context(
        attendance=[{"courseCode": "X", "courseName": "Physics", "attendedClasses": 28, "dutyLeave": 2, "deliveredClasses": 40, "minRequired": 75}]
    )
    row = Toolbox(ctx).get_attendance("physics")
    assert row["percent"] == 75.0 and row["counted_as_attended"] == 30 and row["status"] == "BORDERLINE"
