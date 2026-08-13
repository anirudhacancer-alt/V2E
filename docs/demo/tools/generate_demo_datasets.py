#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import random
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable


SEVERITIES = ["Critical", "High", "Medium", "Low"]
TASK_STATUSES = ["Active", "Blocked", "Done"]
UPDATE_CATEGORIES = [
    "Blocker",
    "WorkCompletion",
    "QAIssue",
    "MaterialDelay",
    "GeneralUpdate",
]
TRADES = [
    "RCC",
    "MEP",
    "Finishing",
    "Procurement",
    "Masonry",
    "Electrical",
    "Plumbing",
    "Carpentry",
    "Steel",
    "Concrete",
    "Painting",
]
ATTENDANCE_STATUSES = ["Present", "Absent"]
USER_ROLES = [
    "SiteSupervisor",
    "MasonLead",
    "ProcurementLead",
    "ElectricalSupervisor",
    "PaintingContractor",
    "SiteManager",
    "CivilEngineer",
    "SteelFixer",
    "Electrician",
    "Plumber",
    "Carpenter",
]
NAMES_1328 = [
    "Rakesh",
    "Aarav",
    "Arjun",
    "Kabir",
    "Rohit",
    "Vikram",
    "Neeraj",
    "Suresh",
    "Aditya",
    "Siddharth",
    "Krish",
    "Dev",
    "Priya",
]
NAMES_1330 = [
    "Ishaan",
    "Agastya",
    "Ayansh",
    "Vihaan",
    "Rudra",
    "Vedant",
    "Harsh",
    "Manish",
    "Tarun",
    "Kiran",
    "Ananya",
    "Amit",
    "Neha",
]
UPDATE_STATUSES = ["Pending", "Processed", "ConvertedToTask", "Escalated", "Saved"]
SCHEDULE_RISKS = ["None", "Low", "Medium", "High", "Critical"]
ATTACHMENT_TYPES = ["Image", "Audio", "Video", "Document"]
TASK_SOURCES = ["Manual", "VoiceUpdate", "AIGenerated", "Escalated"]
LOW_CONFIDENCE_THRESHOLD = 0.65
TASK_GROUP_KEYWORDS = {
    "masonry": "Masonry",
    "electrical": "Electrical",
    "plumbing": "Plumbing",
    "carpentry": "Carpentry",
    "steel": "Steel",
    "concrete": "Concrete",
    "painting": "Painting",
    "mep": "MEP",
    "procurement": "Procurement",
    "finishing": "Finishing",
    "rcc": "RCC",
}
ROLE_FOR_TRADE = {
    "Masonry": "MasonLead",
    "Electrical": "ElectricalSupervisor",
    "Plumbing": "Plumber",
    "Carpentry": "Carpenter",
    "Steel": "SteelFixer",
    "Painting": "PaintingContractor",
    "Procurement": "ProcurementLead",
    "RCC": "CivilEngineer",
    "MEP": "CivilEngineer",
    "Finishing": "SiteSupervisor",
    "Concrete": "CivilEngineer",
}


@dataclass
class Vocab:
    locations: list[str]
    descriptions: list[str]
    vendor_like: list[str]
    causes: list[str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate demo datasets by contract id.")
    parser.add_argument(
        "--repo-root",
        default=Path(__file__).resolve().parents[3],
        type=Path,
        help="Repository root path.",
    )
    parser.add_argument(
        "--contracts",
        nargs="+",
        default=["1328", "1330"],
        help="Contract/project IDs to generate.",
    )
    parser.add_argument(
        "--rows",
        type=int,
        default=120,
        help="Synthetic row count target per top-level demo table.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=20260324,
        help="Deterministic random seed.",
    )
    return parser.parse_args()


def iso_dt(base: datetime, minutes: int) -> str:
    return (base + timedelta(minutes=minutes)).isoformat()


def join_labels(labels: list[str]) -> str:
    if len(labels) <= 1:
        return labels[0] if labels else ""
    if len(labels) == 2:
        return f"{labels[0]} and {labels[1]}"
    return f"{', '.join(labels[:-1])}, and {labels[-1]}"


def build_review_prompt(reasons: list[str], fields: list[str]) -> str:
    field_labels = {
        "location": "location",
        "dueDate": "due date",
        "owner": "owner",
        "category": "category",
        "severity": "severity",
    }
    specific_labels = [field_labels[f] for f in fields if f in field_labels]
    has_low_conf = "low_confidence_extraction" in reasons
    has_task_proposal = "new_task_proposed" in reasons

    if has_low_conf and has_task_proposal:
        if specific_labels:
            return f"Confirm: AI extraction, new task proposal, and {join_labels(specific_labels)}"
        return "Confirm: AI extraction and new task proposal"
    if has_task_proposal:
        if specific_labels:
            return f"Confirm: new task proposal and {join_labels(specific_labels)}"
        return "Confirm: new task proposal"
    if specific_labels:
        if has_low_conf:
            return f"Confirm: AI extraction and {join_labels(specific_labels)}"
        return f"Confirm: {join_labels(specific_labels)}"
    return "Confirm: AI extraction"


def build_review_contract(
    update_status: str,
    confidence: float,
    generated_task_description: str,
    row_index: int,
) -> dict[str, str]:
    requires_review = update_status in {"Pending", "Processed", "Saved", "ConvertedToTask"}
    if not requires_review:
        return {
            "reviewRequired": "0",
            "reviewPrompt": "",
            "reviewReasonsJson": "[]",
            "reviewFieldsJson": "[]",
            "reviewedAt": "",
            "reviewedBy": "",
        }

    reasons: list[str] = []
    fields: list[str] = []

    if confidence < LOW_CONFIDENCE_THRESHOLD or update_status == "Processed":
        reasons.append("low_confidence_extraction")
        fields.append("extraction")

    if update_status in {"Pending", "Saved", "ConvertedToTask"} and generated_task_description.strip():
        reasons.append("new_task_proposed")
        fields.append("taskProposal")

    if row_index % 5 == 0:
        reasons.append("location_uncertain")
        fields.append("location")
    elif row_index % 7 == 0:
        reasons.append("due_date_uncertain")
        fields.append("dueDate")
    elif row_index % 9 == 0:
        reasons.append("owner_uncertain")
        fields.append("owner")

    if not reasons:
        reasons.append("low_confidence_extraction")
        fields.append("extraction")

    prompt = build_review_prompt(reasons, fields)
    return {
        "reviewRequired": "1",
        "reviewPrompt": prompt,
        "reviewReasonsJson": json.dumps(reasons, separators=(",", ":")),
        "reviewFieldsJson": json.dumps(fields, separators=(",", ":")),
        "reviewedAt": "",
        "reviewedBy": "",
    }


def to_uuid(rng: random.Random) -> str:
    # Deterministic RFC 4122 v4-like UUID format.
    bits = rng.getrandbits(128)
    bits &= ~(0xF << 76)
    bits |= (0x4 << 76)
    bits &= ~(0x3 << 62)
    bits |= (0x2 << 62)
    h = f"{bits:032x}"
    return f"{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:]}"


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_rows(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def norm_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def infer_trade(text: str, rng: random.Random) -> str:
    lowered = text.lower()
    for keyword, trade in TASK_GROUP_KEYWORDS.items():
        if keyword in lowered:
            return trade
    return rng.choice(TRADES)


def prepare_vocab(rows: Iterable[dict[str, str]]) -> Vocab:
    locations: Counter[str] = Counter()
    descriptions: Counter[str] = Counter()
    vendor_like: Counter[str] = Counter()
    causes: Counter[str] = Counter()
    for row in rows:
        loc = norm_text(row.get("Location", ""))
        desc = norm_text(row.get("Description", ""))
        vendor = norm_text(row.get("To Package", ""))
        cause = norm_text(row.get("Cause", ""))
        if loc:
            locations[loc] += 1
        if desc:
            descriptions[desc] += 1
        if vendor:
            vendor_like[vendor] += 1
        if cause:
            causes[cause] += 1

    def top_or_default(counter: Counter[str], fallback: list[str]) -> list[str]:
        if counter:
            return [item for item, _ in counter.most_common(300)]
        return fallback

    return Vocab(
        locations=top_or_default(
            locations, ["Tower A - Level 2", "Tower B - Level 5", "Block C - Lobby"]
        ),
        descriptions=top_or_default(
            descriptions,
            [
                "Concrete pour delayed due to pump unavailability.",
                "Electrical rough-in complete for units 201-212.",
                "Client requested sample revision for lobby finishes.",
            ],
        ),
        vendor_like=top_or_default(
            vendor_like, ["Main Contractor", "Electrical Contractor", "MEP Team"]
        ),
        causes=top_or_default(causes, ["System Failure", "Behavioural Failure", "Material Delay"]),
    )


def filter_and_export_real(
    source: Path, out_path: Path, project_key: str, project_id: str
) -> list[dict[str, str]]:
    rows = read_rows(source)
    filtered = [r for r in rows if norm_text(r.get(project_key, "")) == project_id]
    if not filtered:
        raise ValueError(f"No rows found for project {project_id} in {source}")
    fieldnames = list(filtered[0].keys())
    write_rows(out_path, filtered, fieldnames)
    return filtered


def generate_contract_dataset(
    contract_id: str,
    out_dir: Path,
    rows_target: int,
    seed: int,
    vocab: Vocab,
    shared_site: dict[str, object] | None = None,
) -> dict[str, int]:
    rng = random.Random(seed)
    base = datetime(2026, 3, 1, 8, 0, tzinfo=timezone.utc)
    counts: dict[str, int] = {}

    site_id = str(shared_site["id"]) if shared_site else to_uuid(rng)
    manager_user_id = (
        str(shared_site["managerUserId"]) if shared_site else to_uuid(rng)
    )
    supervisor_user_id = (
        str(shared_site["supervisorUserId"]) if shared_site else None
    )
    project_id = to_uuid(rng)

    users: list[dict[str, object]] = []
    demo_names: list[str] | None = None
    if contract_id == "1328":
        demo_names = NAMES_1328
    elif contract_id == "1330":
        demo_names = NAMES_1330
    users.append(
        {
            "id": manager_user_id,
            "email": str(shared_site["managerEmail"]) if shared_site else f"manager{contract_id}@demo.local",
            "name": str(shared_site["managerName"]) if shared_site else (demo_names[0] if demo_names else f"Site Manager {contract_id}"),
            "role": "SiteManager",
            "phone": str(shared_site["managerPhone"]) if shared_site else f"+91900000{contract_id}",
            "employeeId": str(shared_site["managerEmployeeId"]) if shared_site else f"EMP-{contract_id}-001",
            "avatarUrl": "",
            "preferences_pushNotificationsEnabled": "true",
            "preferences_darkModeEnabled": "false",
            "createdAt": iso_dt(base, 0),
            "updatedAt": iso_dt(base, 15),
        }
    )
    for i in range(1, 13):
        role = USER_ROLES[i % len(USER_ROLES)]
        uid = supervisor_user_id if shared_site and role == "SiteSupervisor" else to_uuid(rng)
        users.append(
            {
                "id": uid,
                "email": str(shared_site["supervisorEmail"]) if shared_site and role == "SiteSupervisor" else f"user{i}_{contract_id}@demo.local",
                "name": str(shared_site["supervisorName"]) if shared_site and role == "SiteSupervisor" else (demo_names[i % len(demo_names)] if demo_names else f"Demo User {i} {contract_id}"),
                "role": role,
                "phone": str(shared_site["supervisorPhone"]) if shared_site and role == "SiteSupervisor" else f"+9191{contract_id}{i:04d}"[:14],
                "employeeId": str(shared_site["supervisorEmployeeId"]) if shared_site and role == "SiteSupervisor" else f"EMP-{contract_id}-{i+1:03d}",
                "avatarUrl": "",
                "preferences_pushNotificationsEnabled": "true" if i % 3 else "false",
                "preferences_darkModeEnabled": "true" if i % 4 == 0 else "false",
                "createdAt": iso_dt(base, i * 12),
                "updatedAt": iso_dt(base, i * 12 + 5),
            }
        )
    user_ids = [u["id"] for u in users]

    site_name = (
        str(shared_site["name"])
        if shared_site
        else f"Contract {contract_id} Demo Site"
    )
    site_code = (
        str(shared_site["code"])
        if shared_site
        else f"CTR-{contract_id}"
    )
    site_address = (
        str(shared_site["address"])
        if shared_site
        else f"Sector {int(contract_id) % 100}, Demo City, Haryana"
    )
    site_lat = (
        float(shared_site["latitude"])
        if shared_site
        else (28.4595 + rng.uniform(-0.03, 0.03))
    )
    site_lon = (
        float(shared_site["longitude"])
        if shared_site
        else (77.0266 + rng.uniform(-0.03, 0.03))
    )

    sites = [
        {
            "id": site_id,
            "name": site_name,
            "code": site_code,
            "address": site_address,
            "locationLatitude": site_lat,
            "locationLongitude": site_lon,
            "projectManagerId": manager_user_id,
            "isActive": "true",
            "metadata": json.dumps(
                {
                    "projectId": contract_id,
                    "source": "hybrid-real-synthetic",
                    "multiProjectSite": True,
                    "siteCluster": site_code,
                },
                separators=(",", ":"),
            ),
            "createdAt": iso_dt(base, 0),
            "updatedAt": iso_dt(base, 30),
        }
    ]

    project_code = f"PRJ-{contract_id}"
    project_name = f"Project {contract_id} Execution Stream"
    project_description = f"Demo contract {contract_id} under shared site {site_code}."
    if contract_id == "1328":
        project_code = "RES-1328"
        project_name = "RES-1328"
        project_description = "Residential build — demo contract 1328 (Gurugram site)."
    elif contract_id == "1330":
        project_code = "COM-1330"
        project_name = "COM-1330"
        project_description = "Commercial tower — demo contract 1330 (Gurugram site)."

    projects = [
        {
            "id": project_id,
            "siteId": site_id,
            "code": project_code,
            "name": project_name,
            "description": project_description,
            "isActive": "true",
            "metadata": json.dumps(
                {"contractId": contract_id, "source": "pm+synthetic"},
                separators=(",", ":"),
            ),
            "createdAt": iso_dt(base, 0),
            "updatedAt": iso_dt(base, 20),
        }
    ]

    team_members: list[dict[str, object]] = []
    for i in range(0, 12):
        uid = user_ids[i]
        role = users[i]["role"]
        team_members.append(
            {
                "id": str(shared_site["supervisorTeamMemberId"]) if shared_site and role == "SiteSupervisor" else to_uuid(rng),
                "siteId": site_id,
                "name": users[i]["name"],
                "role": role,
                "email": users[i]["email"],
                "phone": users[i]["phone"],
                "isActive": "true",
                "joinedAt": iso_dt(base, i * 60),
                "createdAt": iso_dt(base, i * 60 + 5),
                "updatedAt": iso_dt(base, i * 60 + 6),
            }
        )
    team_member_ids = [m["id"] for m in team_members]

    updates: list[dict[str, object]] = []
    update_ai_outputs: list[dict[str, object]] = []
    update_attachments: list[dict[str, object]] = []
    risk_downstream_effects: list[dict[str, object]] = []
    risk_recommended_actions: list[dict[str, object]] = []
    tasks: list[dict[str, object]] = []
    task_attachments: list[dict[str, object]] = []
    attendance_sessions: list[dict[str, object]] = []
    attendances: list[dict[str, object]] = []

    for i in range(rows_target):
        trade = infer_trade(vocab.descriptions[i % len(vocab.descriptions)], rng)
        role = ROLE_FOR_TRADE.get(trade, "SiteSupervisor")
        location = vocab.locations[i % len(vocab.locations)]
        summary = vocab.descriptions[i % len(vocab.descriptions)]
        vendor = vocab.vendor_like[i % len(vocab.vendor_like)]
        severity = SEVERITIES[i % len(SEVERITIES)]
        category = UPDATE_CATEGORIES[i % len(UPDATE_CATEGORIES)]

        update_id = to_uuid(rng)
        created_at = iso_dt(base, i * 25)
        update_status = UPDATE_STATUSES[i % len(UPDATE_STATUSES)]
        transcript = (
            f"{location}: {summary} "
            f"Trade {trade} reports {category.lower()} impact with severity {severity.lower()}."
        )
        updates.append(
            {
                "id": update_id,
                "siteId": site_id,
                "projectId": project_id,
                "recordedBy": user_ids[(i + 2) % len(user_ids)],
                "linkedTaskId": "",
                "transcript": transcript,
                "audioUrl": f"https://demo.local/audio/{contract_id}/{i+1}.m4a",
                "audioDuration": 35 + (i % 45),
                "status": update_status,
                "createdAt": created_at,
                "updatedAt": iso_dt(base, i * 25 + 4),
                "isRead": "1" if i % 4 == 1 else "0",
                "readAt": iso_dt(base, i * 25 + 5) if i % 4 == 1 else "",
            }
        )
        update_attachments.append(
            {
                "id": to_uuid(rng),
                "updateId": update_id,
                "taskId": "",
                "url": f"https://demo.local/audio/{contract_id}/{update_id}.m4a",
                "type": "Audio",
                "uploadedAt": iso_dt(base, i * 25 + 1),
            }
        )
        update_attachments.append(
            {
                "id": to_uuid(rng),
                "updateId": update_id,
                "taskId": "",
                "url": f"https://demo.local/images/{contract_id}/{update_id}.jpg",
                "type": "Image",
                "uploadedAt": iso_dt(base, i * 25 + 2),
            }
        )
        if i % 2 == 0:
            update_attachments.append(
                {
                    "id": to_uuid(rng),
                    "updateId": update_id,
                    "taskId": "",
                    "url": f"https://demo.local/videos/{contract_id}/{update_id}.mp4",
                    "type": "Video",
                    "uploadedAt": iso_dt(base, i * 25 + 3),
                }
            )

        due_date = iso_dt(base, i * 25 + 60 * 24)
        confidence = round(0.62 + (i % 33) * 0.01, 2)
        review_contract = build_review_contract(update_status, confidence, summary, i)
        update_ai_outputs.append(
            {
                "updateId": update_id,
                "category": category,
                "trade": trade,
                "location": location,
                "vendor": vendor,
                "severity": severity,
                "ownerRole": role,
                "ownerId": user_ids[(i + 3) % len(user_ids)],
                "dueDate": due_date,
                "generatedTaskDescription": summary,
                "riskImpact": f"Potential delay at {location} if unresolved.",
                "scheduleRisk": SCHEDULE_RISKS[i % len(SCHEDULE_RISKS)],
                "confidence": confidence,
                "blockerSubtype": "",
                "locationBlock": "",
                "locationZone": "",
                "locationLevel": "",
                "locationArea": "",
                **review_contract,
            }
        )
        for idx in range(2):
            risk_downstream_effects.append(
                {
                    "updateId": update_id,
                    "order": idx + 1,
                    "effect": f"Downstream effect {idx+1} for update {i+1} at {location}.",
                }
            )
            risk_recommended_actions.append(
                {
                    "updateId": update_id,
                    "order": idx + 1,
                    "action": f"Recommended action {idx+1} for update {i+1} with {vendor}.",
                }
            )

        task_id = to_uuid(rng)
        task_status = TASK_STATUSES[i % len(TASK_STATUSES)]
        # When a task is linked to an update, normally created_at matches the note.
        # For some rows, backdate the task so API `noteState=Linked` (task predates note) demos work.
        task_created_at = created_at
        if i % 5 != 0 and i % 11 == 0:
            task_created_at = iso_dt(base, i * 25 - 200)
        tasks.append(
            {
                "id": task_id,
                "siteId": site_id,
                "projectId": project_id,
                "title": f"{trade} action #{i+1}",
                "description": summary,
                "ownerId": user_ids[(i + 4) % len(user_ids)],
                "assigneeRole": role,
                "severity": severity,
                "trade": trade,
                "location": location[:200],
                "status": task_status,
                "source": TASK_SOURCES[i % len(TASK_SOURCES)],
                "sourceUpdateId": update_id if i % 5 else "",
                "startDate": iso_dt(base, i * 25 + 30),
                "dueDate": due_date,
                "completedAt": iso_dt(base, i * 25 + 180) if task_status == "Done" else "",
                "createdAt": task_created_at,
                "updatedAt": iso_dt(base, i * 25 + 10),
            }
        )
        for a in range(2):
            task_attachments.append(
                {
                    "id": to_uuid(rng),
                    "taskId": task_id,
                    "url": f"https://demo.local/files/{contract_id}/{task_id}/{a+1}.jpg",
                    "type": ATTACHMENT_TYPES[(i + a) % len(ATTACHMENT_TYPES)],
                    "uploadedAt": iso_dt(base, i * 25 + 11 + a),
                }
            )

        session_id = to_uuid(rng)
        session_date_iso = iso_dt(base, i * 25 + 19)
        session_date_ymd = session_date_iso.split("T")[0]
        attendance_sessions.append(
            {
                "id": session_id,
                "siteId": site_id,
                "projectId": project_id,
                "sessionDate": session_date_ymd,
                "conductedBy": manager_user_id,
                "createdAt": iso_dt(base, i * 25 + 21),
                "updatedAt": iso_dt(base, i * 25 + 22),
            }
        )
        for a in range(5):
            status = ATTENDANCE_STATUSES[(i + a) % len(ATTENDANCE_STATUSES)]
            tm_index = (i + a) % len(team_members)
            attendances.append(
                {
                    "id": to_uuid(rng),
                    "sessionId": session_id,
                    "teamMemberId": team_member_ids[tm_index],
                    "status": status,
                    "notes": "" if status == "Present" else "Absent due to transit delay",
                    "recordedAt": iso_dt(base, i * 25 + 20 + a),
                }
            )

    write_rows(
        out_dir / "users.csv",
        users,
        [
            "id",
            "email",
            "name",
            "role",
            "phone",
            "employeeId",
            "avatarUrl",
            "preferences_pushNotificationsEnabled",
            "preferences_darkModeEnabled",
            "createdAt",
            "updatedAt",
        ],
    )
    counts["users.csv"] = len(users)
    write_rows(
        out_dir / "sites.csv",
        sites,
        [
            "id",
            "name",
            "code",
            "address",
            "locationLatitude",
            "locationLongitude",
            "projectManagerId",
            "isActive",
            "metadata",
            "createdAt",
            "updatedAt",
        ],
    )
    counts["sites.csv"] = len(sites)
    write_rows(
        out_dir / "projects.csv",
        projects,
        [
            "id",
            "siteId",
            "code",
            "name",
            "description",
            "isActive",
            "metadata",
            "createdAt",
            "updatedAt",
        ],
    )
    counts["projects.csv"] = len(projects)
    write_rows(
        out_dir / "team_members.csv",
        team_members,
        [
            "id",
            "siteId",
            "name",
            "role",
            "email",
            "phone",
            "isActive",
            "joinedAt",
            "createdAt",
            "updatedAt",
        ],
    )
    counts["team_members.csv"] = len(team_members)

    file_rows = {
        "updates.csv": (
            updates,
            [
                "id",
                "siteId",
                "projectId",
                "recordedBy",
                "linkedTaskId",
                "transcript",
                "audioUrl",
                "audioDuration",
                "status",
                "createdAt",
                "updatedAt",
                "isRead",
                "readAt",
            ],
        ),
        "update_ai_outputs.csv": (
            update_ai_outputs,
            [
                "updateId",
                "category",
                "trade",
                "location",
                "vendor",
                "severity",
                "ownerRole",
                "ownerId",
                "dueDate",
                "generatedTaskDescription",
                "riskImpact",
                "scheduleRisk",
                "confidence",
                "blockerSubtype",
                "locationBlock",
                "locationZone",
                "locationLevel",
                "locationArea",
                "reviewRequired",
                "reviewPrompt",
                "reviewReasonsJson",
                "reviewFieldsJson",
                "reviewedAt",
                "reviewedBy",
            ],
        ),
        "update_attachments.csv": (
            update_attachments,
            ["id", "updateId", "taskId", "url", "type", "uploadedAt"],
        ),
        "update_risk_downstream_effects.csv": (
            risk_downstream_effects,
            ["updateId", "order", "effect"],
        ),
        "update_risk_recommended_actions.csv": (
            risk_recommended_actions,
            ["updateId", "order", "action"],
        ),
        "tasks.csv": (
            tasks,
            [
                "id",
                "siteId",
                "projectId",
                "title",
                "description",
                "ownerId",
                "assigneeRole",
                "severity",
                "trade",
                "location",
                "status",
                "source",
                "sourceUpdateId",
                "startDate",
                "dueDate",
                "completedAt",
                "createdAt",
                "updatedAt",
            ],
        ),
        "task_attachments.csv": (
            task_attachments,
            ["id", "taskId", "url", "type", "uploadedAt"],
        ),
        "attendance_sessions.csv": (
            attendance_sessions,
            [
                "id",
                "siteId",
                "projectId",
                "sessionDate",
                "conductedBy",
                "createdAt",
                "updatedAt",
            ],
        ),
        "attendances.csv": (
            attendances,
            ["id", "sessionId", "teamMemberId", "status", "notes", "recordedAt"],
        ),
    }
    for filename, (rows, fieldnames) in file_rows.items():
        write_rows(out_dir / filename, rows, fieldnames)
        counts[filename] = len(rows)
    return counts


def contract_bundle_dir(output_root: Path, contract_id: str) -> Path:
    """Bundle folder under docs/demo/datasets (aligns with project codes: RES-1328, COM-1330)."""
    if contract_id == "1328":
        return output_root / "RES-1328"
    if contract_id == "1330":
        return output_root / "COM-1330"
    return output_root / f"contract-{contract_id}"


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    docs_dir = repo_root / "docs"
    source_dir = docs_dir / "demo" / "pm-reference"
    tasks_source = source_dir / "Construction_Data_PM_Tasks_All_Projects.csv"
    forms_source = source_dir / "Construction_Data_PM_Forms_All_Projects.csv"

    output_root = docs_dir / "demo" / "datasets"
    output_root.mkdir(parents=True, exist_ok=True)

    # Shared site model so one site can host multiple projects/contracts.
    shared_rng = random.Random(args.seed + 7777)
    shared_site = {
        "id": to_uuid(shared_rng),
        "managerUserId": to_uuid(shared_rng),
        "supervisorUserId": to_uuid(shared_rng),
        "supervisorTeamMemberId": to_uuid(shared_rng),
        "managerName": "Rakesh",
        "managerEmail": "manager.gurugram@demo.local",
        "managerPhone": "+919000001328",
        "managerEmployeeId": "EMP-GURUGRAM-001",
        "supervisorName": "Narayanan",
        "supervisorEmail": "supervisor.gurugram@demo.local",
        "supervisorPhone": "+919100001328",
        "supervisorEmployeeId": "EMP-GURUGRAM-SUP-001",
        "name": "Gurugram Integrated Campus",
        "code": "SITE-GURUGRAM-01",
        "address": "Sector 58, Gurugram, Haryana",
        "latitude": 28.4211,
        "longitude": 77.0422,
    }

    summary_rows: list[dict[str, object]] = []
    for idx, contract_id in enumerate(args.contracts):
        contract_dir = contract_bundle_dir(output_root, contract_id)
        contract_dir.mkdir(parents=True, exist_ok=True)

        filtered_tasks = filter_and_export_real(
            tasks_source, contract_dir / f"pm_tasks_contract_{contract_id}.csv", "project", contract_id
        )
        filtered_forms = filter_and_export_real(
            forms_source, contract_dir / f"pm_forms_contract_{contract_id}.csv", "Project", contract_id
        )
        vocab = prepare_vocab(filtered_tasks + filtered_forms)
        counts = generate_contract_dataset(
            contract_id=contract_id,
            out_dir=contract_dir,
            rows_target=args.rows,
            seed=args.seed + idx * 999,
            vocab=vocab,
            shared_site=shared_site,
        )
        counts[f"pm_tasks_contract_{contract_id}.csv"] = len(filtered_tasks)
        counts[f"pm_forms_contract_{contract_id}.csv"] = len(filtered_forms)

        for file_name, row_count in sorted(counts.items()):
            summary_rows.append(
                {"contractId": contract_id, "file": file_name, "rows": row_count}
            )

    write_rows(output_root / "generation_summary.csv", summary_rows, ["contractId", "file", "rows"])

    print("Generated demo datasets:")
    for row in summary_rows:
        print(f"- contract {row['contractId']}: {row['file']} ({row['rows']} rows)")


if __name__ == "__main__":
    main()
