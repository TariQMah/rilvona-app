import {
  computeAttendanceGuidance,
  computePercentage,
} from "./chandigarh-university.adapter";
import { importLmsSchema } from "@hiihive/contracts";
import { normalizeTime, parseCuimsTables } from "./cuims-parser";

describe("CUIMS table parser", () => {
  it("reads an attendance table (code + name columns)", () => {
    const out = parseCuimsTables([
      {
        headers: [
          "Sr.",
          "Course Code",
          "Course Name",
          "Faculty",
          "Total Delivered",
          "Total Attended",
          "Attendance %",
        ],
        rows: [
          [
            "1",
            "23CSH-301",
            "Design & Analysis of Algorithms",
            "Dr. A",
            "40",
            "36",
            "90",
          ],
          [
            "2",
            "23CST-302",
            "Operating Systems",
            "Prof. B",
            "38",
            "27",
            "71.05",
          ],
        ],
      },
    ]);
    expect(out.attendance).toHaveLength(2);
    expect(out.attendance[1]).toMatchObject({
      courseCode: "23CST-302",
      attendedClasses: 27,
      deliveredClasses: 38,
    });
    expect(out.unrecognized).toHaveLength(0);
  });

  it("reads attendance where code and name share one cell", () => {
    const out = parseCuimsTables([
      {
        headers: ["Subject", "Held", "Present"],
        rows: [["23CSH-304 - Computer Networks", "36", "30"]],
      },
    ]);
    expect(out.attendance[0]).toMatchObject({
      courseCode: "23CSH-304",
      courseName: "Computer Networks",
      attendedClasses: 30,
    });
  });

  it("reads a flat timetable", () => {
    const out = parseCuimsTables([
      {
        headers: ["Day", "Time", "Subject", "Room", "Faculty"],
        rows: [
          [
            "Monday",
            "09:30 - 10:20",
            "23CSH-301 Algorithms",
            "B3-405",
            "Dr. A",
          ],
          [
            "Tuesday",
            "1.00 PM to 2.40 PM",
            "23CSR-308 Coding Lab",
            "Lab 302",
            "Er. C",
          ],
        ],
      },
    ]);
    expect(out.timetable).toHaveLength(2);
    expect(out.timetable[1]).toMatchObject({
      dayOfWeek: 2,
      startTime: "13:00",
      endTime: "14:40",
      slotType: "LAB",
    });
  });

  it("reads a weekly grid timetable", () => {
    const out = parseCuimsTables([
      {
        headers: ["Day", "09:30-10:20", "10:25-11:15"],
        rows: [
          ["Mon", "23CSH-301 Algorithms, Block B3-405", "Free"],
          ["Wed", "", "23CST-302 Operating Systems"],
        ],
      },
    ]);
    expect(out.timetable).toHaveLength(2);
    expect(out.timetable[0]).toMatchObject({
      dayOfWeek: 1,
      startTime: "09:30",
      courseCode: "23CSH-301",
    });
    expect(out.timetable[1]).toMatchObject({
      dayOfWeek: 3,
      startTime: "10:25",
    });
  });

  it("reads long-format and wide-format marks", () => {
    const out = parseCuimsTables([
      {
        caption: "MST-1",
        headers: ["Course Code", "Course Name", "Marks Obtained", "Max Marks"],
        rows: [["23CSH-301", "Algorithms", "18", "20"]],
      },
      {
        headers: ["Subject", "MST-1 (20)", "Quiz 1", "Assignment"],
        rows: [["23CST-302 Operating Systems", "15.5", "8/10", "-"]],
      },
    ]);
    expect(out.marks).toHaveLength(3);
    expect(out.marks[0]).toMatchObject({
      assessmentName: "MST-1",
      obtainedMarks: 18,
      maxMarks: 20,
    });
    expect(out.marks[1]).toMatchObject({
      assessmentName: "MST-1",
      obtainedMarks: 15.5,
      maxMarks: 20,
    });
    expect(out.marks[2]).toMatchObject({
      assessmentName: "Quiz 1",
      obtainedMarks: 8,
      maxMarks: 10,
    });
  });

  it("reports tables it cannot understand instead of guessing", () => {
    const out = parseCuimsTables([
      { headers: ["Notice", "Date"], rows: [["Fee reminder", "01/10/2026"]] },
    ]);
    expect(
      out.attendance.length + out.timetable.length + out.marks.length,
    ).toBe(0);
    expect(out.unrecognized[0]?.headers).toEqual(["Notice", "Date"]);
  });

  it("normalises 12h and dotted times", () => {
    expect(normalizeTime("9.30 AM")).toBe("09:30");
    expect(normalizeTime("2:05 pm")).toBe("14:05");
    expect(normalizeTime("nonsense")).toBeNull();
  });
});

describe("attendance maths", () => {
  it("applies the 75% rule", () => {
    expect(computePercentage(36, 40)).toBe(90);
    expect(computeAttendanceGuidance(27, 38, 0, 75)).toMatchObject({
      status: "SHORTAGE",
      needToAttend: 6,
    });
    expect(computeAttendanceGuidance(36, 40, 0, 75).status).toBe("SAFE");
  });

  it("reads the slot type from a Type column in the flat timetable", () => {
    const result = parseCuimsTables([
      {
        headers: ["Day", "Time", "Subject", "Room", "Faculty", "Type"],
        rows: [
          [
            "Monday",
            "09:40 - 10:20",
            "Computer Networks",
            "1-3-C",
            "A B",
            "Lecture",
          ],
          [
            "Tuesday",
            "13:00 - 13:40",
            "Networks Lab",
            "1-2-C",
            "C D",
            "Practical",
          ],
          ["Wednesday", "10:00 - 10:40", "Maths", "2-1-A", "E F", "Tutorial"],
        ],
      },
    ]);
    expect(result.timetable.map((slot) => slot.slotType)).toEqual([
      "LECTURE",
      "LAB",
      "TUTORIAL",
    ]);
    expect(result.timetable[1]?.startTime).toBe("13:00");
  });

  it("keeps a lecture and its lab on their own course codes", () => {
    const result = parseCuimsTables([
      {
        headers: ["Day", "Time", "Subject", "Code", "Room", "Faculty", "Type"],
        rows: [
          [
            "Monday",
            "10:40 - 11:25",
            "Design and Analysis of Algorithms",
            "26CAT-611",
            "B-1",
            "A",
            "Lecture",
          ],
          [
            "Tuesday",
            "09:00 - 10:30",
            "Design and Analysis of Algorithms Lab",
            "26CAP-612",
            "Lab 2",
            "B",
            "Practical",
          ],
        ],
      },
    ]);
    expect(result.timetable).toHaveLength(2);
    expect(result.timetable[0]).toMatchObject({
      courseCode: "26CAT-611",
      courseName: "Design and Analysis of Algorithms",
      slotType: "LECTURE",
    });
    expect(result.timetable[1]).toMatchObject({
      courseCode: "26CAP-612",
      courseName: "Design and Analysis of Algorithms Lab",
      slotType: "LAB",
    });
  });
});

describe("portal profile payload", () => {
  const base = {
    studentUid: "23BCS10452",
    sourceUrl: "https://students.cuchd.in/StudentHome.aspx",
    tables: [],
  };

  it("accepts a profile with a small image, mentor card and notices", () => {
    const parsed = importLmsSchema.safeParse({
      ...base,
      profile: {
        name: "Priya Sharma",
        section: "23BCS-4",
        photo: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
        mentor: { name: "Dr. Jane Roe", lines: ["Dr. Jane Roe"] },
        notices: [
          { kind: "MESSAGE", title: "Meet your mentor", date: "2026-10-12" },
        ],
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects anything that is not an inline image", () => {
    const parsed = importLmsSchema.safeParse({
      ...base,
      profile: { photo: "https://evil.example/x.png", notices: [] },
    });
    expect(parsed.success).toBe(false);
    const script = importLmsSchema.safeParse({
      ...base,
      profile: { photo: "data:text/html;base64,PHNjcmlwdD4=", notices: [] },
    });
    expect(script.success).toBe(false);
  });

  it("is optional so older app versions keep working", () => {
    expect(importLmsSchema.safeParse(base).success).toBe(true);
  });
});
