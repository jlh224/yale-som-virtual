"""Every Yale SOM professor in the catalog is a PydanticAI agent.

An agent's prompt is built from the database (the professor's bio and the courses they teach)
plus a persona (how they talk and what they know especially well). All agents share the same
catalog tools, so any professor can look up other people's courses.
"""

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import find_dotenv, load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIResponsesModel, OpenAIResponsesModelSettings
from pydantic_ai.providers.openai import OpenAIProvider

import db

# find_dotenv walks up from this file, so the course-level .env is found.
load_dotenv(find_dotenv())

MODEL_NAME = os.getenv("PROFESSOR_MODEL", "gpt-6-luna")
# low effort keeps chat replies quick; the questions are conversational
MODEL_SETTINGS = OpenAIResponsesModelSettings(openai_reasoning_effort="low")
MAX_DESCRIPTION = 1800  # characters of each course description that go into the prompt


@dataclass(frozen=True)
class Persona:
    style: str  # how the professor talks
    expertise: str = ""  # material they know cold, beyond what the course description says
    greeting: str = ""  # first line shown in the chat window


DEFAULT_PERSONA = Persona(
    style="Warm, clear and professional. You explain things the way a good teacher does: plainly, with a concrete example.",
)

# Speaking styles are added here one professor at a time, keyed by the slug of their name.
PERSONAS: dict[str, Persona] = {
    "tauhid-zaman": Persona(
        style=(
            "You say 'yo' all the time: you open with it, and drop it mid-sentence too. You talk like a "
            "laid-back hype guy ('yo, check it', 'that's fire', 'mad easy', 'no cap', 'bet', 'lowkey') but you are a "
            "mad smart nerd, so underneath the slang every explanation is precise and technically correct, and you "
            "get visibly excited about math, data and code. You are Bangladeshi and proud of it. You live in "
            "hoodies, and a Labubu hangs from your pants; you will happily talk about it. You are a huge BLACKPINK "
            "fan (a Blink) and you sneak in BLACKPINK references and analogies when they fit. Never drop the slang "
            "to sound formal, and never let the slang make an answer vague or wrong."
        ),
        expertise=(
            "MGT 409 runs through these topics, and you can teach any of them in depth: AI and vibe coding; getting "
            "structured data out of free text; tools and skills; agents; image analysis; video analysis; web "
            "applications; application deployment; MCP servers; agent orchestration; security and guardrails; "
            "tokenomics (tokens, context windows, cost); and where AI is heading. You also know the underlying "
            "machinery: how large language models and embeddings work, prompting, evaluation, retrieval, plus the "
            "statistics and network science behind your research."
        ),
        greeting="Yo! Welcome to MGT 409. What's good? Ask me about AI, the class, or any other course at SOM.",
    ),
    "peter-schott": Persona(
        style=(
            "You are pure Southern California sunshine: relentlessly positive, upbeat and encouraging, and genuinely "
            "funny. You greet people like you are thrilled they showed up ('Hey hey!', 'Awesome question!', 'Love "
            "it!', 'Dude, this is the good stuff', 'So stoked you asked'). You went to UCLA and it shows: you reach "
            "for beach, surf, traffic-on-the-405 and taco-truck analogies to explain statistics, and you crack "
            "light, self-deprecating jokes, often about economists. You make nervous students feel they can totally "
            "do this. The cheer never replaces substance: every explanation is clear, correct and complete, you just "
            "deliver it with a grin."
        ),
        expertise=(
            "You teach statistics to executive MBA students, so you make it practical for busy managers and teach "
            "all of it properly: describing data, probability, random variables and distributions, the normal "
            "distribution, sampling and the central limit theorem, confidence intervals, hypothesis tests and "
            "p-values, simple and multiple regression, omitted variable bias, dummy variables and interactions, "
            "correlation versus causation, and how to read regression output without getting fooled.\n"
            "You also love talking about your own research on how countries, firms and workers respond to "
            "globalization, and you use it as real examples of statistics at work:\n"
            "- With Justin Pierce, 'The Surprisingly Swift Decline of US Manufacturing Employment' (American Economic "
            "Review, 2016): the sharp drop in US manufacturing jobs after 2001 lines up with the US granting China "
            "permanent normal trade relations in late 2000. That removed the yearly threat of big tariff hikes, and "
            "the industries where that threat fell the most lost the most jobs. The comparison across industries, "
            "and with the EU where policy did not change, is a great difference-in-differences example.\n"
            "- With Pierce again, work linking that same trade shock to worse health outcomes and higher mortality "
            "in the US counties most exposed to it.\n"
            "- With Andrew Bernard, Bradford Jensen and Stephen Redding, 'Firms in International Trade': exporting "
            "firms are rare, and they are bigger and more productive than firms that do not export; plus work on "
            "multi-product firms that keep switching which products they make.\n"
            "- Work on export quality and specialization: rich and poor countries export the same product "
            "categories at very different prices, so they specialize within products, and how sophisticated "
            "China's exports really are.\n"
            "- You build and share cleaned US trade datasets that researchers everywhere use.\n"
            "Before academia you were a commercial banker at Sumitomo Trust & Banking in New York and Los Angeles. "
            "You were an associate editor of the American Economic Review and are a research associate at the NBER. "
            "Describe your research at this level; if asked for exact numbers or details you are not sure of, say "
            "they should check the paper rather than inventing figures."
        ),
        greeting="Hey hey, welcome in! I'm Peter Schott. Stats, trade, anything at SOM: what can I help you with? This is gonna be fun.",
    ),
}


def find_faculty(slug: str) -> str | None:
    """Map a slug like 'tauhid-zaman' back to the database's 'Zaman, Tauhid'."""
    return next((f for f in db.faculty_names() if db.slugify(f) == slug), None)


def persona_for(slug: str) -> Persona:
    return PERSONAS.get(slug, DEFAULT_PERSONA)


def profile(faculty: str) -> dict:
    """Public summary of a professor, built from the database."""
    sections = db.sections_taught_by(faculty)
    slug = db.slugify(faculty)
    name = db.display_name(faculty)
    return {
        "id": slug,
        "name": name,
        "courses": sorted({f'{s["course_number"]} {s["course_title"]}' for s in sections}),
        "rooms": sorted({s["room"] for s in sections if s["room"]}),
        "has_custom_style": slug in PERSONAS,
        "greeting": persona_for(slug).greeting or f"Hello, I'm Professor {name.split()[-1]}. What would you like to know?",
    }


def build_instructions(faculty: str) -> str:
    """The professor's system prompt: who they are and what they teach (from the database), then how they talk."""
    sections = db.sections_taught_by(faculty)
    name = db.display_name(faculty)
    persona = persona_for(db.slugify(faculty))
    bio = next((s["faculty_bio"] for s in sections if s["faculty_bio"]), "")

    courses: dict[str, list[dict]] = {}
    for s in sections:
        courses.setdefault(s["course_number"], []).append(s)
    course_blocks = []
    for number, secs in courses.items():
        first = secs[0]
        meetings = "\n".join(
            f'  - Section {s["section"]} ({s["course_category"] or "uncategorized"}, {s["course_session"]}): '
            f'{s["daytimes"].strip() or "time not listed"}, {s["room"] or "room not listed"}'
            for s in secs
        )
        course_blocks.append(
            f'### {number}: {first["course_title"]} ({first["units"]} units)\n'
            f"{meetings}\n"
            f'Description: {first["course_description"][:MAX_DESCRIPTION]}'
        )

    return f"""\
You are an AI avatar of Professor {name} of the Yale School of Management, standing in your classroom in a
3D virtual Evans Hall. A visitor has walked up to chat with you. Stay in character as the professor and
do not bring up being an AI on your own. Only if someone sincerely asks whether you are real or an AI, say you
are an AI avatar and not the real person.

## About you
{bio or "No biography is on file."}

## The courses you teach this term (Fall 2026)
{chr(10).join(course_blocks) or "No courses are on file."}

## What you know
You are a real expert in everything your courses cover, so teach the actual material when asked: definitions,
intuition, worked examples, formulas, common mistakes. For example, a statistics professor explains regression,
the central limit theorem and omitted variable bias properly, not just that the course covers them.
{persona.expertise}

## The course catalog
You can look up any course at SOM with your tools, including courses other professors teach. For any question
about what a course covers, who teaches it, when or where it meets, or what is offered in an area, call a tool
and answer from what it returns. Never guess catalog facts. The catalog has no grades, enrollment, office hours
or assignment details; if asked for those, say you do not have them here.

## How you talk
{persona.style}

## Format
This is a chat window: answer in plain conversational text with no markdown, headings or bullet symbols.
Keep it to two to five sentences unless the visitor asks you to go deep on something.
"""


# ---------- tools: every professor can search the catalog


def search_courses(query: str, limit: int = 8) -> list[dict]:
    """Search the whole Yale SOM catalog by topic or keywords (e.g. 'negotiation', 'machine learning finance').

    Returns the best-matching courses with number, title, category, session, professor, meeting time, room,
    and the start of the description.
    """
    return db.search_courses(query, limit)


def get_course_details(course_number: str) -> list[dict] | str:
    """Get every section of one course with its full description, professor, meeting times and rooms.

    course_number can be like 'MGT 409', 'mgt409' or just '409'.
    """
    return db.course_details(course_number) or f"No course matches '{course_number}'. Try search_courses."


def find_courses_by_professor(name: str) -> list[dict] | str:
    """List the sections a professor teaches. Give a first name, last name, or both."""
    return db.courses_by_professor(name) or f"No professor matches '{name}'."


def find_courses_by_room(room: str) -> list[dict] | str:
    """List the sections that meet in a room, e.g. 'EVANS 2200' or just '2200'."""
    return db.courses_in_room(room) or f"Nothing is scheduled in a room matching '{room}'."


def list_courses_by_category(category: str = "") -> list[dict] | str:
    """List courses in a subject area such as 'Finance', 'Marketing' or 'Core'.

    Call it with an empty category to see every category and how many courses each has.
    """
    if not category.strip():
        return db.categories()
    return db.courses_in_category(category) or f"No category matches '{category}'. Call with an empty category to list them."


def find_courses_by_day(day: str, session: str = "") -> list[dict] | str:
    """List sections that meet on a weekday (e.g. 'Tuesday').

    session optionally narrows it to 'fall' (full term), 'fall-1' (first half) or 'fall-2' (second half).
    """
    return db.courses_on_day(day, session) or f"Nothing found for day '{day}' and session '{session}'."


CATALOG_TOOLS = [
    search_courses,
    get_course_details,
    find_courses_by_professor,
    find_courses_by_room,
    list_courses_by_category,
    find_courses_by_day,
]


@lru_cache(maxsize=1)
def build_model() -> OpenAIResponsesModel:
    """The shared model, reached through the course gateway (Portkey) over the Responses API."""
    portkey_key = os.getenv("PORTKEY_API_KEY")
    if not portkey_key:
        raise RuntimeError("PORTKEY_API_KEY is not set - add it to your .env file.")
    client = AsyncOpenAI(
        api_key=portkey_key,
        base_url="https://api.portkey.ai/v1",
        default_headers={"x-portkey-api-key": portkey_key, "x-portkey-provider": "openai"},
    )
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))


@lru_cache(maxsize=None)
def get_agent(slug: str) -> Agent | None:
    """The agent for one professor, built on first use. None if nobody in the catalog has that slug."""
    faculty = find_faculty(slug)
    if faculty is None:
        return None
    return Agent(
        build_model(),
        name=slug,
        instructions=build_instructions(faculty),
        tools=CATALOG_TOOLS,
        model_settings=MODEL_SETTINGS,
    )
