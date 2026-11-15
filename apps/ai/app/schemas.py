"""Request and response shapes. The API sends the student's data with every question; nothing is stored here."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Loose(BaseModel):
    # The API may add fields over time; ignore what we do not use.
    model_config = ConfigDict(extra="ignore")


class ChatMessage(_Loose):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=2000)


class HistoryEntry(_Loose):
    date: str = ""
    timing: str = ""
    status: str = ""


class Course(_Loose):
    courseCode: str = ""
    courseName: str = ""
    facultyName: str | None = None
    attendedClasses: int = 0
    deliveredClasses: int = 0
    dutyLeave: int = 0
    percentage: float = 0
    minRequired: float = 75
    lastLectureAt: str | None = None
    history: list[HistoryEntry] = []

    @property
    def counted(self) -> int:
        """Classes that count as attended: attended plus duty leave, never more than were delivered."""
        return min(self.deliveredClasses, self.attendedClasses + self.dutyLeave)


class Slot(_Loose):
    dayOfWeek: int
    startTime: str
    endTime: str
    courseCode: str = ""
    courseName: str = ""
    room: str = ""
    facultyName: str | None = None
    slotType: str = "LECTURE"


class Mark(_Loose):
    semester: int = 0
    courseCode: str = ""
    courseName: str = ""
    assessmentName: str = ""
    category: str = ""
    obtainedMarks: float = 0
    maxMarks: float = 0
    weightage: float | None = None
    publishedAt: str = ""


class Alert(_Loose):
    category: str = ""
    courseCode: str | None = None
    title: str = ""
    body: str = ""
    publishedAt: str = ""


class Notice(_Loose):
    kind: str = ""
    title: str = ""
    body: str | None = None
    date: str | None = None


class Student(_Loose):
    name: str | None = None
    program: str | None = None
    semester: int | None = None
    section: str | None = None
    mentor: str | None = None


class StudentContext(_Loose):
    """What the student's phone and the university portal have given Rilvona."""

    now: str  # ISO 8601 with the student's UTC offset
    timezone: str = "Asia/Kolkata"
    student: Student = Student()
    attendance: list[Course] = []
    timetable: list[Slot] = []
    marks: list[Mark] = []
    alerts: list[Alert] = []
    notices: list[Notice] = []


class ChatRequest(_Loose):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    context: StudentContext


class ChatResponse(BaseModel):
    reply: str
    toolsUsed: list[str] = []
