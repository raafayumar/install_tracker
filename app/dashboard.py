"""
FILE: app/dashboard.py
User dashboard view for Install Tracker.
"""

import streamlit as st
import pandas as pd
from datetime import date as date_type
from sqlalchemy.orm import Session

from app.models import (
    Install, Pipeline, PipelineStage, PipelineType, ActivityType,
    InstallActivity, SiteStageHistory,
)
from app.services import (
    get_installs_for_user, get_all_installs, add_comment, add_summary,
    get_or_create_install, update_install, list_users,
)
from app.utils import (
    format_dt, stage_badge_html, generate_auto_summary,
    compute_site_specific_od, compute_site_specific_ppe,
    days_to_complete, type_badge, region_badge, status_badge,
    partner_badge, jira_link_html, bool_icon, no_data_badge,
)


INSTALL_TYPES = ["New Site", "AddOn"]
REGIONS = ["US", "EU", "CA", "Tesla", "Asia"]
STATUS_OPTIONS = ["In-progress", "Complete", "On Hold", "Cancelled"]


def render_dashboard(session: Session, selected_user: str):
    """Render the user dashboard."""

    if selected_user != "All":
        st.markdown(f"#### Hello, {selected_user}")
    st.markdown("## Install Dashboard")

    with st.expander("Register New Install", expanded=False):
        _render_register_form(session, selected_user)

    st.divider()

    if selected_user == "All":
        installs = get_all_installs(session)
    else:
        installs = get_installs_for_user(session, selected_user)

    if not installs:
        st.info("No installs found.")
        return

    # Sort: Complete → Blocked/On Hold → In-progress (default)
    installs = _sort_by_status(installs)

    _render_overview_table(session, installs, selected_user)

    # Only show detail panels for individual user views, not "All"
    if selected_user != "All":
        st.divider()
        st.markdown("### Install Details")

        if installs:
            options = [inst.comp_site_id for inst in installs]

            # Check query params for clickable navigation
            qp = st.query_params
            pre_select = 0
            if "install" in qp:
                target = qp["install"]
                if target in options:
                    pre_select = options.index(target)

            selected_idx = st.selectbox(
                "Select Install", range(len(options)),
                format_func=lambda i: f"{options[i]} — {installs[i].site_name or 'Unnamed'}",
                index=pre_select,
                key="detail_select",
            )
            if selected_idx is not None:
                _render_install_detail(session, installs[selected_idx], selected_user)


# ── Overview table ───────────────────────────────────────────────────────────

def _render_overview_table(session: Session, installs, selected_user: str):
    show_owner = (selected_user == "All")
    html_rows = []
    for inst in installs:
        ob_pipe = _get_pipeline(inst, PipelineType.OB)
        ppe_pipe = _get_pipeline(inst, PipelineType.PPE)
        ss_od = compute_site_specific_od(inst)
        ss_ppe = compute_site_specific_ppe(inst)
        summary = generate_auto_summary(inst)
        dtc = days_to_complete(inst)

        # Get per-site task counts from latest batch
        site_tasks = _get_latest_site_tasks(session, inst.comp_site_id)

        # Consolidated model + deployed display
        ob_model = _model_display(inst.general_od_model, ss_od, inst.ob_deployed)
        ppe_model = _model_display(inst.general_ppe_model, ss_ppe, inst.ppe_deployed)

        # Make ID a clickable link (preserves sidebar view via query param)
        view_param = f'&amp;view={selected_user}' if selected_user != 'All' else ''
        id_link = f'<a href="?install={inst.comp_site_id}{view_param}" target="_self" style="color:#60a5fa;text-decoration:none;font-weight:700;">{inst.comp_site_id}</a>'

        start = inst.start_date or '—'
        days = f'{dtc}d' if dtc is not None else '—'

        row = f"""<tr>
            <td>{id_link}</td>
            <td>{inst.site_name or '—'}</td>"""
        if show_owner:
            row += f"<td>{inst.owner_name or '—'}</td>"
        row += f"""
            <td>{type_badge(inst.install_type or 'New Site')}</td>
            <td>{region_badge(inst.region or 'US')}</td>
            <td>{partner_badge(ob_pipe.partner if ob_pipe else '—')}</td>
            <td>{partner_badge(ppe_pipe.partner if ppe_pipe else '—')}</td>
            <td>{_format_stages_with_status(ob_pipe, site_tasks, 'OB')}</td>
            <td>{_format_stages_with_status(ppe_pipe, site_tasks, 'PPE')}</td>
            <td>{ob_model}</td>
            <td>{ppe_model}</td>
            <td style="font-size:0.82em;">{start}</td>
            <td style="font-size:0.82em;">{days}</td>
            <td style="font-size:0.8em;">{summary}</td>
        </tr>"""
        html_rows.append(row)

    owner_header = "<th>Owner</th>" if show_owner else ""

    table_html = f"""
    <style>
        .tracker-table {{ width:100%; border-collapse:collapse; font-size:0.86em; }}
        .tracker-table th {{
            background:#1e293b; color:#e2e8f0; padding:6px 8px;
            text-align:left; white-space:nowrap; position:sticky; top:0;
            border-bottom:2px solid #334155;
        }}
        .tracker-table td {{ padding:5px 8px; border-bottom:1px solid #334155; white-space:nowrap; }}
        .tracker-table tr:hover {{ background:#1e293b55; }}
        .tracker-table a:hover {{ text-decoration:underline !important; }}
    </style>
    <div style="overflow-x:auto; max-height:500px; overflow-y:auto;">
    <table class="tracker-table">
    <thead><tr>
        <th>ID</th><th>Name</th>{owner_header}<th>Type</th><th>Region</th>
        <th>OB Partner</th><th>PPE Partner</th>
        <th>OB Stage</th><th>PPE Stage</th>
        <th>OB Model</th><th>PPE Model</th>
        <th>Start</th><th>Days</th>
        <th>Summary</th>
    </tr></thead>
    <tbody>{''.join(html_rows)}</tbody>
    </table></div>
    """
    st.markdown(table_html, unsafe_allow_html=True)


# ── Register form ────────────────────────────────────────────────────────────

def _render_register_form(session: Session, owner: str):
    with st.form("register_install", clear_on_submit=True):
        c1, c2, c3, c4 = st.columns(4)
        comp_site = c1.text_input("CompID-SiteID", placeholder="150-936")
        site_name = c2.text_input("Site Name")
        install_type = c3.selectbox("Type", INSTALL_TYPES)
        region = c4.selectbox("Region", REGIONS)

        c5, c6 = st.columns(2)
        jira_link = c5.text_input("Jira Link")

        submitted = st.form_submit_button("Register", type="primary")
        if submitted and comp_site:
            inst = get_or_create_install(session, comp_site)
            inst.owner_name = owner if owner != "All" else None
            inst.site_name = site_name or None
            inst.jira_link = jira_link or None
            inst.install_type = install_type
            inst.region = region
            inst.start_date = date_type.today()
            session.flush()
            session.commit()
            st.success(f"Install **{inst.comp_site_id}** registered!")
            st.rerun()


# ── Detail panel ─────────────────────────────────────────────────────────────

def _render_install_detail(session: Session, inst: Install, current_user: str):
    cid = inst.comp_site_id
    is_admin = (current_user == "— Admin Update —" or current_user == "All")

    # ── Frozen info header (read-only for normal users) ──────────────────
    jira_html = jira_link_html(inst.jira_link) if inst.jira_link else "—"
    dtc = days_to_complete(inst)
    info_html = f"""
    <div style="background:#1e293b; border-radius:6px; padding:12px 16px; margin-bottom:12px;">
      <table style="width:100%; font-size:0.88em; border-collapse:collapse;">
        <tr>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">ID</td>
          <td style="padding:3px 12px 3px 0;"><b>{cid}</b></td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Name</td>
          <td style="padding:3px 12px 3px 0;"><b>{inst.site_name or '—'}</b></td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Owner</td>
          <td style="padding:3px 12px 3px 0;">{inst.owner_name or '—'}</td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Jira</td>
          <td style="padding:3px 0;">{jira_html}</td>
        </tr>
        <tr>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Type</td>
          <td style="padding:3px 12px 3px 0;">{type_badge(inst.install_type or 'New Site')}</td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Region</td>
          <td style="padding:3px 12px 3px 0;">{region_badge(inst.region or 'US')}</td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">Start</td>
          <td style="padding:3px 12px 3px 0; font-size:0.9em;">{inst.start_date or '—'}</td>
          <td style="padding:3px 12px 3px 0; color:#94a3b8;">End</td>
          <td style="padding:3px 0; font-size:0.9em;">{inst.end_date or '—'}</td>
        </tr>
      </table>
    </div>
    """
    st.markdown(info_html, unsafe_allow_html=True)

    # Admin-only edit for frozen fields
    if is_admin:
        if st.checkbox("Edit Install Info (Admin Only)", key=f"adm_toggle_{cid}",
                        value=False):
            with st.form(f"admin_edit_{cid}", clear_on_submit=False):
                a1, a2 = st.columns(2)
                new_site = a1.text_input("Site Name", value=inst.site_name or "",
                                         key=f"adn_{cid}")
                new_owner = a2.text_input("Owner", value=inst.owner_name or "",
                                          key=f"ado_{cid}")
                a3, a4 = st.columns(2)
                cur_type = inst.install_type if inst.install_type in INSTALL_TYPES else "New Site"
                new_type = a3.selectbox("Type", INSTALL_TYPES,
                                        index=INSTALL_TYPES.index(cur_type),
                                        key=f"adt_{cid}")
                cur_region = inst.region if inst.region in REGIONS else "US"
                new_region = a4.selectbox("Region", REGIONS,
                                          index=REGIONS.index(cur_region),
                                          key=f"adr_{cid}")
                new_jira = st.text_input("Jira Link", value=inst.jira_link or "",
                                         key=f"adj_{cid}")
                if st.form_submit_button("Update Info"):
                    update_install(
                        session, cid,
                        site_name=new_site or None,
                        owner_name=new_owner or None,
                        jira_link=new_jira or None,
                        install_type=new_type,
                        region=new_region,
                    )
                    session.commit()
                    st.success("Updated!")
                    st.rerun()

    # ── Editable section: Status, Models, Deployment ─────────────────────
    with st.form(f"edit_{cid}", clear_on_submit=False):
        st.markdown(
            '<p style="font-size:0.92em; color:#94a3b8; margin-bottom:4px;">'
            'Status & Tracking</p>', unsafe_allow_html=True)

        c1, c2, c3 = st.columns(3)
        cur_status = inst.status if inst.status in STATUS_OPTIONS else "In-progress"
        new_status = c1.selectbox("Status", STATUS_OPTIONS,
                                  index=STATUS_OPTIONS.index(cur_status),
                                  key=f"st_{cid}")

        # Model eval section — clear labels
        st.markdown(
            '<p style="font-size:0.92em; color:#94a3b8; margin:8px 0 4px;">'
            'General Model Evaluation — tick if eval <b>passed</b></p>',
            unsafe_allow_html=True)
        m1, m2 = st.columns(2)
        new_gen_od = m1.checkbox("OD Model Passed",
                                 value=inst.general_od_model,
                                 key=f"god_{cid}")
        new_gen_ppe = m2.checkbox("PPE Model Passed",
                                  value=inst.general_ppe_model,
                                  key=f"gppe_{cid}")

        st.markdown(
            '<p style="font-size:0.92em; color:#94a3b8; margin:8px 0 4px;">'
            'Deployment Confirmation</p>',
            unsafe_allow_html=True)
        d1, d2 = st.columns(2)
        new_ob_dep = d1.checkbox("OB Model Deployed",
                                 value=inst.ob_deployed,
                                 key=f"obd_{cid}")
        new_ppe_dep = d2.checkbox("PPE Model Deployed",
                                  value=inst.ppe_deployed,
                                  key=f"pped_{cid}")

        if st.form_submit_button("Save", type="primary"):
            new_end = inst.end_date
            if new_status == "Complete" and cur_status != "Complete":
                new_end = date_type.today()
            elif new_status != "Complete":
                new_end = None

            update_install(
                session, cid,
                status=new_status,
                end_date=new_end,
                general_od_model=new_gen_od,
                general_ppe_model=new_gen_ppe,
                ob_deployed=new_ob_dep,
                ppe_deployed=new_ppe_dep,
            )
            session.commit()
            st.success("Saved!")
            st.rerun()

    # ── Computed summary row ─────────────────────────────────────────────
    summary = generate_auto_summary(inst)
    ss_od = compute_site_specific_od(inst)
    ss_ppe = compute_site_specific_ppe(inst)

    if summary or ss_od is not None:
        computed_html = '<div style="background:#1a2332; border-radius:6px; padding:10px 14px; margin:8px 0; font-size:0.88em;">'
        if summary:
            computed_html += f'<div style="margin-bottom:4px;"><b>Summary:</b> {summary}</div>'
        parts = []
        if ss_od is not None:
            parts.append(f'Site-Specific OD: <b>{"Yes" if ss_od else "No"}</b>')
        if ss_ppe is not None:
            parts.append(f'Site-Specific PPE: <b>{"Yes" if ss_ppe else "No"}</b>')
        if dtc is not None:
            parts.append(f'Days: <b>{dtc}</b>')
        if parts:
            computed_html += ' &nbsp;|&nbsp; '.join(parts)
        computed_html += '</div>'
        st.markdown(computed_html, unsafe_allow_html=True)

    # ── Pipeline snapshot ────────────────────────────────────────────────
    p1, p2 = st.columns(2)
    ob = _get_pipeline(inst, PipelineType.OB)
    ppe = _get_pipeline(inst, PipelineType.PPE)
    site_tasks = _get_latest_site_tasks(session, cid)
    with p1:
        st.markdown("**OB Pipeline**")
        if ob:
            st.markdown(partner_badge(ob.partner or "—"),
                        unsafe_allow_html=True)
            _show_active_stages(ob, site_tasks, "OB")
        else:
            st.caption("No data yet")
    with p2:
        st.markdown("**PPE Pipeline**")
        if ppe:
            st.markdown(partner_badge(ppe.partner or "—"),
                        unsafe_allow_html=True)
            _show_active_stages(ppe, site_tasks, "PPE")
        else:
            st.caption("No data yet")

    # ── Comments (shown by default) ──────────────────────────────────────
    st.markdown("**Comments**")
    comment_text = st.text_area(
        "Comment", key=f"comment_{cid}",
        placeholder="Type a comment...",
        label_visibility="collapsed",
        height=80,
    )
    if st.button("Post", key=f"btn_comment_{cid}"):
        if comment_text.strip():
            add_comment(session, cid, current_user, comment_text)
            session.commit()
            st.success("Comment added!")
            st.rerun()

    # Show existing comments inline
    comments = (
        session.query(InstallActivity)
        .filter(
            InstallActivity.comp_site_id == cid,
            InstallActivity.activity_type == ActivityType.COMMENT,
        )
        .order_by(InstallActivity.created_at.desc())
        .limit(10)
        .all()
    )
    if comments:
        for act in comments:
            ts = format_dt(act.created_at)
            st.markdown(
                f"💬 **{act.user_name}** ({ts}): {act.message}"
            )

    # ── Stage History ────────────────────────────────────────────────
    show_history_stages = st.checkbox(
        "Show Stage History", key=f"stage_hist_{cid}", value=False
    )
    if show_history_stages:
        _render_stage_history(session, cid)

    # ── Activity timeline ────────────────────────────────────────────
    show_history = st.checkbox("Show Activity History", key=f"hist_{cid}",
                               value=False)
    if show_history:
        activities = (
            session.query(InstallActivity)
            .filter(InstallActivity.comp_site_id == cid)
            .order_by(InstallActivity.created_at.desc())
            .limit(30)
            .all()
        )
        if not activities:
            st.caption("No activity yet")
        for act in activities:
            ts = format_dt(act.created_at)
            st.markdown(
                f"**{act.activity_type.value}** — *{act.user_name}* ({ts})"
            )
            if act.message:
                st.text(act.message)
            st.markdown("---")


# ── Helpers ──────────────────────────────────────────────────────────────────

_STATUS_SORT_ORDER = {
    "Complete": 0,
    "Blocked": 1,
    "On Hold": 2,
    "In-progress": 3,
}


def _sort_by_status(installs):
    """Sort installs: Complete first, then Blocked/On Hold, then In-progress."""
    return sorted(
        installs,
        key=lambda i: _STATUS_SORT_ORDER.get(i.status or "In-progress", 3),
    )


def _model_display(general_passed: bool, site_specific, deployed: bool = False) -> str:
    """Return a short label for the model column, with deployed indicator."""
    check = ' ✅' if deployed else ''
    if site_specific is True:
        return f'<span style="color:#22c55e;font-weight:600;">Site-Specific{check}</span>'
    if general_passed is True:
        return f'<span style="color:#3b82f6;font-weight:600;">General{check}</span>'
    return "—"


def _get_pipeline(inst: Install, ptype: PipelineType):
    for p in inst.pipelines:
        if p.pipeline_type == ptype:
            return p
    return None


def _format_stages(pipe) -> str:
    if pipe is None:
        return "—"
    active = [s for s in pipe.stages if s.active]
    if not active:
        return "—"
    return ", ".join(s.stage_name for s in active)


def _format_stages_with_status(pipe, site_tasks: dict = None, pipe_type: str = "") -> str:
    """Format stages for the overview table, including no-data badge and per-site task counts."""
    if pipe is None:
        return "—"
    if getattr(pipe, "data_status", "active") == "no_data":
        return no_data_badge()
    active = [s for s in pipe.stages if s.active]
    if not active:
        return "—"

    parts = []
    for s in active:
        task_count = _lookup_site_task_count(site_tasks, pipe_type, s.stage_name)
        if task_count is not None:
            parts.append(f"{s.stage_name} ({task_count})")
        else:
            parts.append(s.stage_name)
    return ", ".join(parts)


def _show_active_stages(pipe, site_tasks: dict = None, pipe_type: str = ""):
    active = [s for s in pipe.stages if s.active]
    if not active:
        st.caption("No active stages")
        return
    for s in active:
        task_count = _lookup_site_task_count(site_tasks, pipe_type, s.stage_name)
        label = f"{s.stage_name} ({task_count} tasks)" if task_count is not None else s.stage_name
        st.markdown(
            stage_badge_html(label),
            unsafe_allow_html=True,
        )


def _get_latest_site_tasks(session, comp_site_id: str) -> dict:
    """
    Get per-site task counts from the latest batch in SiteStageHistory.
    Returns dict like {('OB', 'Protex Review'): 200, ('PPE', 'Annotate'): 50}
    """
    # Find the latest batch_id for this site
    latest = (
        session.query(SiteStageHistory)
        .filter(SiteStageHistory.comp_site_id == comp_site_id)
        .order_by(SiteStageHistory.created_at.desc())
        .first()
    )
    if not latest:
        return {}

    # Get all entries from that batch for this site
    entries = (
        session.query(SiteStageHistory)
        .filter(
            SiteStageHistory.comp_site_id == comp_site_id,
            SiteStageHistory.batch_id == latest.batch_id,
        )
        .all()
    )

    result = {}
    for e in entries:
        ptype = e.pipeline_type.value if e.pipeline_type else ""
        key = (ptype, e.stage_name)
        if e.frames is not None:
            result[key] = e.frames
    return result


def _lookup_site_task_count(site_tasks: dict, pipe_type: str, stage_name: str):
    """Look up per-site task count, returns int or None."""
    if not site_tasks:
        return None
    return site_tasks.get((pipe_type, stage_name))


def _render_stage_history(session, comp_site_id: str):
    """Show a table of past stage snapshots for this install."""
    history = (
        session.query(SiteStageHistory)
        .filter(SiteStageHistory.comp_site_id == comp_site_id)
        .order_by(SiteStageHistory.created_at.desc())
        .limit(100)
        .all()
    )
    if not history:
        st.caption("No stage history yet.")
        return

    import pandas as pd
    rows = []
    for h in history:
        rows.append({
            "Date": format_dt(h.created_at),
            "Partner": h.partner,
            "Pipeline": h.pipeline_type.value if h.pipeline_type else "—",
            "Stage": h.stage_name,
            "Site Tasks": h.frames if h.frames is not None else "—",
        })
    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)
