"""Read-only access to the Yale SOM course catalog (data/yale_som.db).

Everything the professor agents know about the catalog comes through these functions.
One row in the `courses` table is one section of a course.
"""

import re
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "yale_som.db"

SECTION_FIELDS = "course_number, section, course_title, course_category, course_session, faculty_1, daytimes, room, units"
DAY_CODES = {
    "monday": "Mo", "mon": "Mo", "mo": "Mo", "m": "Mo",
    "tuesday": "Tu", "tue": "Tu", "tues": "Tu", "tu": "Tu", "t": "Tu",
    "wednesday": "We", "wed": "We", "we": "We", "w": "We",
    "thursday": "Th", "thu": "Th", "thur": "Th", "thurs": "Th", "th": "Th",
    "friday": "Fr", "fri": "Fr", "fr": "Fr", "f": "Fr",
    "saturday": "Sa", "sat": "Sa", "sa": "Sa",
    "sunday": "Su", "sun": "Su", "su": "Su",
}


def _rows(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql, params).fetchall()]
    finally:
        con.close()


def display_name(faculty: str) -> str:
    """'Zaman, Tauhid' -> 'Tauhid Zaman'."""
    last, _, first = faculty.partition(",")
    return f"{first.strip()} {last.strip()}".strip()


def slugify(faculty: str) -> str:
    """'Zaman, Tauhid' -> 'tauhid-zaman'."""
    return re.sub(r"[^a-z0-9]+", "-", display_name(faculty).lower()).strip("-")


def faculty_names() -> list[str]:
    """Every faculty name as stored in the database ('Last, First')."""
    return [r["faculty_1"] for r in _rows("select distinct faculty_1 from courses where faculty_1 <> '' order by 1")]


def sections_taught_by(faculty: str) -> list[dict]:
    """Full rows (with description and bio) for every section this exact faculty name teaches."""
    return _rows("select * from courses where faculty_1 = ? order by course_number, section", (faculty,))


def search_courses(query: str, limit: int = 8) -> list[dict]:
    """Rank courses by how many of the query's words appear in the title, number, category, professor or description."""
    words = [w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 1]
    if not words:
        return []
    scored = {}
    for r in _rows(f"select {SECTION_FIELDS}, course_description from courses"):
        title, number = r["course_title"].lower(), r["course_number"].lower()
        other = f'{r["course_category"]} {r["faculty_1"]}'.lower()
        desc = r["course_description"].lower()
        score = sum(4 * (w in title) + 4 * (w in number.replace(" ", "")) + 2 * (w in other) + (w in desc) for w in words)
        best = scored.get(r["course_number"])
        if score and (best is None or score > best[0]):
            r["course_description"] = r["course_description"][:300]
            scored[r["course_number"]] = (score, r)
    ranked = sorted(scored.values(), key=lambda s: -s[0])[: max(1, min(limit, 20))]
    return [r for _, r in ranked]


def course_details(course_number: str) -> list[dict]:
    """Every section of a course, with the full description. Accepts 'MGT 409', 'mgt409' or just '409'."""
    key = re.sub(r"\s+", "", course_number).lower()
    return _rows(
        f"select {SECTION_FIELDS}, timings_start, timings_end, course_description, syllabus from courses "
        "where replace(lower(course_number), ' ', '') = ? or replace(lower(course_number), ' ', '') like ? "
        "order by course_number, section",
        (key, f"%{key}" if key.isdigit() else key),
    )


def courses_by_professor(name: str) -> list[dict]:
    """Sections taught by anyone whose name contains every word given (first or last name, any order)."""
    words = re.findall(r"[a-z]+", name.lower())
    if not words:
        return []
    where = " and ".join("lower(faculty_1) like ?" for _ in words)
    return _rows(f"select {SECTION_FIELDS} from courses where {where} order by faculty_1, course_number, section", tuple(f"%{w}%" for w in words))


def courses_in_room(room: str) -> list[dict]:
    """Sections that meet in a room. Accepts 'EVANS 2200' or just '2200'."""
    return _rows(f"select {SECTION_FIELDS} from courses where lower(room) like ? order by timings_day, timings_start", (f"%{room.strip().lower()}%",))


def categories() -> list[dict]:
    return _rows("select course_category as category, count(distinct course_number) as courses from courses where course_category <> '' group by 1 order by 2 desc")


def courses_in_category(category: str) -> list[dict]:
    return _rows(
        "select distinct course_number, course_title, course_category, course_session, faculty_1 from courses "
        "where lower(course_category) like ? order by course_number",
        (f"%{category.strip().lower()}%",),
    )


def courses_on_day(day: str, session: str = "") -> list[dict]:
    """Sections that meet on a weekday, optionally limited to a session ('fall', 'fall-1', 'fall-2')."""
    code = DAY_CODES.get(day.strip().lower())
    if not code:
        return []
    sql = f"select {SECTION_FIELDS} from courses where timings_day like ?"
    params: tuple = (f"%{code}%",)
    if session.strip():
        sql += " and lower(course_session) = ?"
        params += (session.strip().lower(),)
    return _rows(sql + " order by timings_start, course_number", params)
