"""
FILE: app/utils.py
Shared utilities for Install Tracker.
"""

from datetime import datetime, timezone, date


def normalise_comp_site_id(raw: str) -> str:
    """Strip whitespace and ensure consistent formatting."""
    return raw.replace(" ", "").strip()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def format_dt(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M UTC")


# ── Auto-computed fields (matching spreadsheet formulas) ─────────────────────

def compute_site_specific_od(install) -> bool | None:
    if (install.status or "").lower() == "complete":
        return not install.general_od_model
    return None


def compute_site_specific_ppe(install) -> bool | None:
    if (install.status or "").lower() == "complete":
        return not install.general_ppe_model
    return None


def generate_auto_summary(install) -> str:
    if (install.status or "").lower() != "complete":
        return ""
    g_od = install.general_od_model
    g_ppe = install.general_ppe_model
    if not g_od and not g_ppe:
        return "Trained site-specific model for both object detection & roi-ppe"
    elif not g_od and g_ppe:
        return "Trained site-specific model for Object detection & used general roi-ppe model"
    elif g_od and g_ppe:
        return "Used general model for both object detection & roi-ppe"
    else:
        return "Trained site-specific roi-ppe model & used general object detection model"


def days_to_complete(install) -> int | None:
    if install.start_date and install.end_date:
        delta = install.end_date - install.start_date
        return max(delta.days, 0)
    return None


# ── Color-coded HTML helpers ─────────────────────────────────────────────────

TYPE_COLOURS = {
    "New Site": "#2563eb",   # blue
    "AddOn": "#7c3aed",     # purple
}

REGION_COLOURS = {
    "US": "#059669",
    "EU": "#2563eb",
    "CA": "#dc2626",
    "Tesla": "#e11d48",
    "Asia": "#d97706",
}

STATUS_COLOURS = {
    "Complete": "#16a34a",
    "In-progress": "#ca8a04",
    "On Hold": "#ea580c",
    "Cancelled": "#dc2626",
}

PARTNER_COLOURS = {
    "Cogito": "#6366f1",
    "Sunix": "#0891b2",
    "Abelling": "#c026d3",
    "Bants": "#059669",
}

STAGE_COLOURS = {
    "Annotate": "#3b82f6",
    "Review": "#f59e0b",
    "Protex Review": "#10b981",
}


def _badge(text: str, colour: str) -> str:
    return (
        f'<span style="background:{colour};color:#fff;padding:1px 7px;'
        f'border-radius:3px;font-size:0.82em;white-space:nowrap;">'
        f'{text}</span>'
    )


def type_badge(install_type: str) -> str:
    c = TYPE_COLOURS.get(install_type, "#6b7280")
    return _badge(install_type, c)


def region_badge(region: str) -> str:
    c = REGION_COLOURS.get(region, "#6b7280")
    return _badge(region, c)


def status_badge(status: str) -> str:
    c = STATUS_COLOURS.get(status, "#6b7280")
    return _badge(status, c)


def partner_badge(partner_name: str) -> str:
    if not partner_name or partner_name == "—":
        return "—"
    # Match base partner name (e.g. "Cogito" from "Cogito_v2" or "Cogito-ppe")
    base = partner_name.split("_")[0].split("-")[0]
    c = PARTNER_COLOURS.get(base, "#6b7280")
    return _badge(partner_name, c)


def stage_badge_html(stage_name: str) -> str:
    colour = STAGE_COLOURS.get(stage_name, "#6b7280")
    return _badge(stage_name, colour)


def jira_link_html(url: str) -> str:
    """Render a Jira logo that links to the ticket."""
    if not url:
        return "—"
    # Small Jira SVG icon inline
    return (
        f'<a href="{url}" target="_blank" style="text-decoration:none;" title="{url}">'
        f'<img src="https://cdn.worldvectorlogo.com/logos/jira-1.svg" '
        f'width="20" height="20" style="vertical-align:middle;margin-right:4px;">'
        f'Jira</a>'
    )


def bool_icon(val) -> str:
    if val is True:
        return "✅"
    elif val is False:
        return "—"
    return "—"


def no_data_badge() -> str:
    """Orange badge indicating no new data in the latest Slack update."""
    return (
        '<span style="background:#ea580c;color:#fff;padding:1px 7px;'
        'border-radius:3px;font-size:0.78em;white-space:nowrap;">'
        '⚠ No New Data</span>'
    )

