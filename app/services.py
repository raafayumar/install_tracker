"""
FILE: app/services.py
Business-logic layer: CRUD for installs / pipelines, and idempotent stage processing.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import (
    User, Install, Pipeline, PipelineStage,
    PipelineType, ActivityType,
    StageSnapshot, SiteStageHistory,
)
from app.activity import log_activity
from app.utils import normalise_comp_site_id


# ── Users ────────────────────────────────────────────────────────────────────

def get_or_create_user(session: Session, name: str) -> User:
    user = session.execute(
        select(User).where(User.name == name)
    ).scalar_one_or_none()
    if user is None:
        user = User(name=name)
        session.add(user)
        session.flush()
    return user


def list_users(session: Session) -> List[User]:
    return list(session.execute(select(User).order_by(User.name)).scalars())


# ── Installs ─────────────────────────────────────────────────────────────────

def get_or_create_install(session: Session, comp_site_id: str) -> Install:
    cid = normalise_comp_site_id(comp_site_id)
    install = session.get(Install, cid)
    if install is None:
        install = Install(comp_site_id=cid)
        session.add(install)
        session.flush()
    return install


def get_installs_for_user(session: Session, owner_name: str) -> List[Install]:
    return list(
        session.execute(
            select(Install)
            .where(Install.owner_name == owner_name)
            .order_by(Install.comp_site_id)
        ).scalars()
    )


def get_all_installs(session: Session) -> List[Install]:
    return list(
        session.execute(
            select(Install).order_by(Install.comp_site_id)
        ).scalars()
    )


def update_install(session: Session, comp_site_id: str, **kwargs) -> Install:
    install = session.get(Install, normalise_comp_site_id(comp_site_id))
    if install is None:
        raise ValueError(f"Install {comp_site_id} not found")
    for k, v in kwargs.items():
        setattr(install, k, v)
    session.flush()
    return install


# ── Pipelines ────────────────────────────────────────────────────────────────

def get_or_create_pipeline(
    session: Session,
    comp_site_id: str,
    pipeline_type: PipelineType,
    partner: str | None = None,
) -> Pipeline:
    cid = normalise_comp_site_id(comp_site_id)
    pipe = session.execute(
        select(Pipeline).where(
            Pipeline.comp_site_id == cid,
            Pipeline.pipeline_type == pipeline_type,
        )
    ).scalar_one_or_none()

    if pipe is None:
        pipe = Pipeline(
            comp_site_id=cid,
            pipeline_type=pipeline_type,
            partner=partner,
        )
        session.add(pipe)
        session.flush()
    elif partner and pipe.partner != partner:
        pipe.partner = partner
        session.flush()

    return pipe


# ── Idempotent stage processing ──────────────────────────────────────────────

def process_parser_results(
    session: Session,
    parsed_blocks: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Apply parser output to the database (idempotent).

    1.  Generate a batch_id (UTC timestamp) for this update.
    2.  Save StageSnapshot rows (aggregate per partner+stage — immutable).
    3.  Save SiteStageHistory rows (per site — immutable).
    4.  Update active PipelineStage rows (deactivate old, insert new).
    5.  Detect "no new data" pipelines and set data_status accordingly.
    6.  Clean up snapshots older than 30 days.

    Returns stats dict for UI feedback.
    """
    now = datetime.now(timezone.utc)
    batch_id = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    stats = {"installs_touched": set(), "stages_created": 0, "errors": []}
    new_stage_ids: set[int] = set()  # track IDs of stages created in THIS batch

    # Track which (comp_site_id, pipeline_type) pairs are mentioned
    mentioned_pipelines: set[tuple[str, str]] = set()

    for block in parsed_blocks:
        partner = block["partner"]
        p_type = PipelineType(block["pipeline_type"])

        for stage_info in block["stages"]:
            # ── 1. Save aggregate StageSnapshot ──────────────────────
            snapshot = StageSnapshot(
                batch_id=batch_id,
                partner=partner,
                pipeline_type=p_type,
                stage_name=stage_info["stage_name"],
                tasks=stage_info["tasks"],
                frames=stage_info["frames"],
                datasets=stage_info.get("datasets", []),
                created_at=now,
            )
            session.add(snapshot)

            # ── 2. Process each dataset (site) ───────────────────────
            for ds in stage_info["datasets"]:
                try:
                    cid = normalise_comp_site_id(ds)

                    # Track this pipeline as mentioned
                    mentioned_pipelines.add((cid, p_type.value))

                    # Save per-site history row
                    # Use per-site task count from new format if available
                    ds_tasks = stage_info.get("dataset_tasks", {})
                    per_site_tasks = ds_tasks.get(ds) if ds_tasks else None
                    site_hist = SiteStageHistory(
                        batch_id=batch_id,
                        comp_site_id=cid,
                        partner=partner,
                        pipeline_type=p_type,
                        stage_name=stage_info["stage_name"],
                        frames=per_site_tasks,  # per-site tasks (new format) or None
                        created_at=now,
                    )
                    session.add(site_hist)

                    # Ensure install exists
                    get_or_create_install(session, cid)

                    # Ensure pipeline exists
                    pipe = get_or_create_pipeline(
                        session, cid, p_type, partner=partner
                    )

                    # Add new active stage
                    new_stage = PipelineStage(
                        pipeline_id=pipe.id,
                        stage_name=stage_info["stage_name"],
                        tasks=stage_info["tasks"],
                        frames=stage_info["frames"],
                        active=True,
                    )
                    session.add(new_stage)
                    session.flush()  # get the ID immediately
                    new_stage_ids.add(new_stage.id)
                    stats["stages_created"] += 1
                    stats["installs_touched"].add(cid)

                except Exception as exc:
                    stats["errors"].append(f"{ds}: {exc}")

    # ── 3. Deactivate old stages (everything NOT in this batch) ──────
    _deactivate_old_stages(session, stats["installs_touched"], new_stage_ids)

    # ── 4. Detect "no new data" pipelines ────────────────────────────
    _update_data_status(session, mentioned_pipelines)

    # ── 5. Log activity for each touched install ─────────────────────
    for cid in stats["installs_touched"]:
        log_activity(
            session, cid,
            activity_type=ActivityType.PARSER_UPDATE,
            message=f"Slack parser update — {stats['stages_created']} stage records created",
            metadata={"partners": [b["partner"] for b in parsed_blocks],
                      "batch_id": batch_id},
        )

    # ── 6. Clean up old snapshots ────────────────────────────────────
    cleanup_old_snapshots(session, days=30)

    stats["installs_touched"] = list(stats["installs_touched"])
    session.flush()
    return stats


def _deactivate_old_stages(session: Session, comp_site_ids, new_stage_ids: set):
    """
    For each touched install's pipelines, deactivate ALL active stages
    that were NOT created in this batch.  This ensures only the latest
    update's stages are shown.
    """
    for cid in comp_site_ids:
        pipes = session.execute(
            select(Pipeline).where(Pipeline.comp_site_id == cid)
        ).scalars().all()

        for pipe in pipes:
            for s in pipe.stages:
                if s.active and s.id not in new_stage_ids:
                    s.active = False


def _update_data_status(session: Session, mentioned_pipelines: set):
    """
    After processing a Slack update, mark pipelines that were NOT mentioned
    as 'no_data', and pipelines that WERE mentioned as 'active'.
    Only affects non-complete installs.
    """
    all_pipelines = session.execute(select(Pipeline)).scalars().all()

    for pipe in all_pipelines:
        # Skip pipelines for completed installs
        install = session.get(Install, pipe.comp_site_id)
        if install and (install.status or "").lower() == "complete":
            continue

        key = (pipe.comp_site_id, pipe.pipeline_type.value)
        if key in mentioned_pipelines:
            pipe.data_status = "active"
        else:
            pipe.data_status = "no_data"

    session.flush()


def cleanup_old_snapshots(session: Session, days: int = 30):
    """Delete StageSnapshot and SiteStageHistory rows older than `days`."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    session.query(StageSnapshot).filter(
        StageSnapshot.created_at < cutoff
    ).delete(synchronize_session=False)

    session.query(SiteStageHistory).filter(
        SiteStageHistory.created_at < cutoff
    ).delete(synchronize_session=False)

    session.flush()


# ── Comments & Summaries ─────────────────────────────────────────────────────

def add_comment(
    session: Session,
    comp_site_id: str,
    user_name: str,
    message: str,
):
    log_activity(
        session,
        normalise_comp_site_id(comp_site_id),
        activity_type=ActivityType.COMMENT,
        user_name=user_name,
        message=message,
    )


def add_summary(
    session: Session,
    comp_site_id: str,
    user_name: str,
    message: str,
):
    log_activity(
        session,
        normalise_comp_site_id(comp_site_id),
        activity_type=ActivityType.SUMMARY,
        user_name=user_name,
        message=message,
    )

