"""
FILE: app/analytics.py
Analytics dashboard for Install Tracker — powered by Plotly.
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models import (
    Install, Pipeline, PipelineType,
    StageSnapshot, SiteStageHistory,
)
from app.utils import days_to_complete


# ── Colour palettes (consistent with utils.py) ──────────────────────────────

PARTNER_COLORS = {
    "Cogito_v2": "#6366f1",
    "Cogito-ppe": "#818cf8",
    "Sunix_v2": "#0891b2",
    "Sunix-ppe": "#22d3ee",
    "Abelling_v2": "#c026d3",
    "Abelling-ppe": "#e879f9",
}

STAGE_COLORS = {
    "Annotate": "#3b82f6",
    "Review": "#f59e0b",
    "Protex Review": "#10b981",
}

PIPELINE_COLORS = {
    "OB": "#6366f1",
    "PPE": "#f97316",
}


def render_analytics(session: Session):
    """Render the analytics dashboard."""

    st.markdown("## 📊 Analytics Dashboard")

    # ── Fetch data ───────────────────────────────────────────────────
    snapshots = _load_snapshots(session)
    site_history = _load_site_history(session)

    if snapshots.empty:
        st.info("No snapshot data yet. Paste Slack messages via the Admin view to start collecting data.")
        return

    # ── KPI Cards ────────────────────────────────────────────────────
    _render_kpi_cards(session)

    st.divider()

    # ── Chart 1: Partner Workload Trend ──────────────────────────────
    _render_partner_workload_trend(snapshots)

    st.divider()

    # ── Chart 2: Stage Distribution Over Time ────────────────────────
    _render_stage_distribution(snapshots)

    st.divider()

    # ── Chart 3: Current Partner × Stage Breakdown ───────────────────
    _render_current_breakdown(snapshots)

    st.divider()

    # ── Chart 4: Install Data Presence Timeline ──────────────────────
    _render_install_timeline(session, site_history)


# ── KPI Cards ────────────────────────────────────────────────────────────────

def _render_kpi_cards(session: Session):
    installs = session.execute(select(Install)).scalars().all()

    active = [i for i in installs if (i.status or "").lower() != "complete"]
    complete = [i for i in installs if (i.status or "").lower() == "complete"]

    # Average days to complete
    dtc_values = [days_to_complete(i) for i in complete if days_to_complete(i) is not None]
    avg_dtc = round(sum(dtc_values) / len(dtc_values), 1) if dtc_values else "—"

    # No-data count
    no_data_pipes = session.execute(
        select(Pipeline).where(Pipeline.data_status == "no_data")
    ).scalars().all()

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Active Installs", len(active))
    c2.metric("Completed", len(complete))
    c3.metric("Avg Days to Complete", avg_dtc)
    c4.metric("⚠ No-Data Pipelines", len(no_data_pipes))


# ── Chart 1: Partner Workload Trend ──────────────────────────────────────────

def _render_partner_workload_trend(snapshots: pd.DataFrame):
    st.markdown("### Partner Workload Trend")
    st.caption("Total tasks and frames per partner over time")

    metric_col = st.radio(
        "Metric", ["Tasks", "Frames"],
        horizontal=True, key="workload_metric"
    )
    y_col = "tasks" if metric_col == "Tasks" else "frames"

    # Aggregate per batch_date + partner
    grouped = (
        snapshots
        .groupby(["batch_date", "partner"])[y_col]
        .sum()
        .reset_index()
    )

    if grouped.empty:
        st.caption("Not enough data yet.")
        return

    fig = px.line(
        grouped,
        x="batch_date",
        y=y_col,
        color="partner",
        color_discrete_map=PARTNER_COLORS,
        markers=True,
        labels={"batch_date": "Date", y_col: metric_col, "partner": "Partner"},
    )
    fig.update_layout(
        template="plotly_dark",
        height=400,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


# ── Chart 2: Stage Distribution Over Time ────────────────────────────────────

def _render_stage_distribution(snapshots: pd.DataFrame):
    st.markdown("### Stage Distribution Over Time")
    st.caption("How work is distributed across stages per day (stacked by stage)")

    pipeline_filter = st.radio(
        "Pipeline", ["All", "OB", "PPE"],
        horizontal=True, key="stage_dist_pipe"
    )

    filtered = snapshots.copy()
    if pipeline_filter != "All":
        filtered = filtered[filtered["pipeline_type"] == pipeline_filter]

    grouped = (
        filtered
        .groupby(["batch_date", "stage_name"])["tasks"]
        .sum()
        .reset_index()
    )

    if grouped.empty:
        st.caption("Not enough data yet.")
        return

    fig = px.bar(
        grouped,
        x="batch_date",
        y="tasks",
        color="stage_name",
        color_discrete_map=STAGE_COLORS,
        barmode="stack",
        labels={"batch_date": "Date", "tasks": "Tasks", "stage_name": "Stage"},
    )
    fig.update_layout(
        template="plotly_dark",
        height=400,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


# ── Chart 3: Current Partner × Stage Breakdown ──────────────────────────────

def _render_current_breakdown(snapshots: pd.DataFrame):
    st.markdown("### Current Partner × Stage Breakdown")
    st.caption("Latest batch — work distribution per partner and stage")

    latest_batch = snapshots["batch_id"].max()
    latest = snapshots[snapshots["batch_id"] == latest_batch]

    grouped = (
        latest
        .groupby(["partner", "stage_name"])["tasks"]
        .sum()
        .reset_index()
    )

    if grouped.empty:
        st.caption("No data for latest batch.")
        return

    fig = px.bar(
        grouped,
        x="partner",
        y="tasks",
        color="stage_name",
        color_discrete_map=STAGE_COLORS,
        barmode="group",
        labels={"partner": "Partner", "tasks": "Tasks", "stage_name": "Stage"},
    )
    fig.update_layout(
        template="plotly_dark",
        height=400,
        xaxis_tickangle=-30,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=40, r=20, t=40, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)


# ── Chart 4: Install Data Presence Timeline ──────────────────────────────────

def _render_install_timeline(session: Session, site_history: pd.DataFrame):
    st.markdown("### Install Data Presence Timeline")
    st.caption("Select an install to see when it appeared in each stage over time")

    if site_history.empty:
        st.caption("No site history data yet.")
        return

    # Get list of installs that have history
    available = sorted(site_history["comp_site_id"].unique().tolist())
    selected_site = st.selectbox("Select Install", available, key="timeline_site")

    if not selected_site:
        return

    site_data = site_history[site_history["comp_site_id"] == selected_site].copy()

    if site_data.empty:
        st.caption("No history for this install.")
        return

    # Pipeline filter
    pipe_filter = st.radio(
        "Pipeline", ["All", "OB", "PPE"],
        horizontal=True, key="timeline_pipe"
    )
    if pipe_filter != "All":
        site_data = site_data[site_data["pipeline_type"] == pipe_filter]

    if site_data.empty:
        st.caption(f"No {pipe_filter} data for this install.")
        return

    # Create a presence heatmap: rows = stages, columns = dates
    pivot = site_data.pivot_table(
        index="stage_name",
        columns="batch_date",
        values="comp_site_id",
        aggfunc="count",
        fill_value=0,
    )

    # Convert to binary (1 = present, 0 = not)
    pivot = (pivot > 0).astype(int)

    # Ensure consistent stage ordering
    stage_order = ["Annotate", "Review", "Protex Review"]
    ordered_stages = [s for s in stage_order if s in pivot.index]
    remaining = [s for s in pivot.index if s not in stage_order]
    pivot = pivot.reindex(ordered_stages + remaining)

    fig = go.Figure(data=go.Heatmap(
        z=pivot.values,
        x=[str(d) for d in pivot.columns],
        y=pivot.index.tolist(),
        colorscale=[
            [0, "#1e293b"],   # absent — dark slate
            [1, "#22c55e"],   # present — green
        ],
        showscale=False,
        hovertemplate="Stage: %{y}<br>Date: %{x}<br>Present: %{z}<extra></extra>",
    ))
    fig.update_layout(
        template="plotly_dark",
        height=250,
        xaxis_title="Date",
        yaxis_title="Stage",
        margin=dict(l=40, r=20, t=20, b=40),
    )
    st.plotly_chart(fig, use_container_width=True)

    # Also show the raw history table
    with st.expander("Raw History Data"):
        display_df = site_data[["batch_date", "partner", "pipeline_type", "stage_name"]].copy()
        display_df = display_df.sort_values("batch_date", ascending=False)
        st.dataframe(display_df, use_container_width=True, hide_index=True)


# ── Data Loaders ─────────────────────────────────────────────────────────────

def _load_snapshots(session: Session) -> pd.DataFrame:
    """Load StageSnapshot data into a DataFrame."""
    rows = session.execute(select(StageSnapshot)).scalars().all()
    if not rows:
        return pd.DataFrame()

    data = []
    for r in rows:
        data.append({
            "batch_id": r.batch_id,
            "batch_date": r.created_at.date() if r.created_at else None,
            "partner": r.partner,
            "pipeline_type": r.pipeline_type.value if r.pipeline_type else None,
            "stage_name": r.stage_name,
            "tasks": r.tasks or 0,
            "frames": r.frames or 0,
        })
    return pd.DataFrame(data)


def _load_site_history(session: Session) -> pd.DataFrame:
    """Load SiteStageHistory data into a DataFrame."""
    rows = session.execute(select(SiteStageHistory)).scalars().all()
    if not rows:
        return pd.DataFrame()

    data = []
    for r in rows:
        data.append({
            "batch_id": r.batch_id,
            "batch_date": r.created_at.date() if r.created_at else None,
            "comp_site_id": r.comp_site_id,
            "partner": r.partner,
            "pipeline_type": r.pipeline_type.value if r.pipeline_type else None,
            "stage_name": r.stage_name,
            "frames": r.frames,
        })
    return pd.DataFrame(data)
