"""
FILE: app/activity.py
Activity logging for Install Tracker.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models import InstallActivity, ActivityType


def log_activity(
    session: Session,
    comp_site_id: str,
    activity_type: ActivityType,
    message: str = "",
    user_name: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Write a single activity record."""
    entry = InstallActivity(
        comp_site_id=comp_site_id,
        user_name=user_name or "system",
        activity_type=activity_type,
        message=message,
        metadata_=metadata or {},
        created_at=datetime.now(timezone.utc),
    )
    session.add(entry)
    # caller is responsible for commit (via get_session context manager)
