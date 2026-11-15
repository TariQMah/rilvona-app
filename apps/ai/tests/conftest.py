import pytest

from app.schemas import StudentContext

# A Wednesday 21 Oct 2026, 10:00 in India.
NOW = "2026-10-21T10:00:00+05:30"


def make_context(**overrides) -> StudentContext:
    data = {
        "now": NOW,
        "student": {"name": "Karan Dixit", "program": "B.E. CSE", "semester": 5, "section": "26MAM-2"},
        "attendance": [
            {"courseCode": "CSE-101", "courseName": "Python Programming", "attendedClasses": 41, "deliveredClasses": 50, "minRequired": 75},
            {"courseCode": "CSE-202", "courseName": "Design and Analysis of Algorithms", "attendedClasses": 30, "deliveredClasses": 40, "minRequired": 75},
            {"courseCode": "CSE-303", "courseName": "Advanced Database Management System", "attendedClasses": 28, "deliveredClasses": 40, "minRequired": 75},
            {"courseCode": "CSE-404", "courseName": "PL/SQL Lab", "attendedClasses": 14, "deliveredClasses": 20, "minRequired": 75},
        ],
        "timetable": [
            {"dayOfWeek": 3, "startTime": "09:55", "endTime": "10:40", "courseCode": "CSE-101", "courseName": "Python Programming", "room": "E1-415", "facultyName": "Ajay Yadav", "slotType": "TUTORIAL"},
            {"dayOfWeek": 3, "startTime": "10:40", "endTime": "11:25", "courseCode": "CSE-202", "courseName": "Design and Analysis of Algorithms", "room": "E1-213", "slotType": "LECTURE"},
            {"dayOfWeek": 4, "startTime": "09:55", "endTime": "10:40", "courseCode": "CSE-303", "courseName": "Advanced Database Management System", "room": "E1-213", "slotType": "LECTURE"},
            {"dayOfWeek": 4, "startTime": "11:25", "endTime": "13:05", "courseCode": "CSE-404", "courseName": "PL/SQL Lab", "room": "Lab-2", "slotType": "LAB"},
        ],
        "marks": [
            {"courseCode": "CSE-101", "courseName": "Python Programming", "assessmentName": "Quiz 1", "category": "INTERNAL", "obtainedMarks": 8, "maxMarks": 10},
            {"courseCode": "CSE-101", "courseName": "Python Programming", "assessmentName": "MST", "category": "THEORY", "obtainedMarks": 18, "maxMarks": 30},
        ],
        "alerts": [{"category": "EXAM", "title": "Lab exam", "body": "Bring ID", "publishedAt": "2026-10-20T10:00:00Z"}],
    }
    data.update(overrides)
    return StudentContext.model_validate(data)


@pytest.fixture
def ctx() -> StudentContext:
    return make_context()
