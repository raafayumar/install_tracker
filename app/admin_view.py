"""
FILE: app/admin_view.py
Admin view: paste Slack messages and auto-update pipelines.
"""

import streamlit as st
from sqlalchemy.orm import Session

from app.parser import parse_slack_message
from app.services import process_parser_results


def render_admin_view(session: Session):
    """Render the admin Slack-parser page."""

    st.markdown("## ⚙️ Admin — Slack Message Processor")
    st.caption(
        "Paste a daily Slack status message below. "
        "The parser will extract partner blocks and update pipeline stages."
    )

    raw_text = st.text_area(
        "Slack Message",
        height=400,
        placeholder="Paste the full Slack message here…",
        key="admin_slack_input",
    )

    col1, col2 = st.columns([1, 3])
    preview_btn = col1.button("🔍 Preview Parse")
    apply_btn = col2.button("✅ Apply to Database", type="primary")

    # ── Preview ──────────────────────────────────────────────────────────
    if preview_btn and raw_text.strip():
        parsed = parse_slack_message(raw_text)
        if not parsed:
            st.warning("No partner blocks were detected. Check the message format.")
        else:
            st.success(f"Found **{len(parsed)}** partner block(s)")
            for block in parsed:
                with st.expander(
                    f"{'🔵' if block['pipeline_type'] == 'OB' else '🟠'} "
                    f"{block['partner']}  ({block['pipeline_type']})"
                ):
                    for stage in block["stages"]:
                        st.markdown(
                            f"**{stage['stage_name']}** — "
                            f"{stage['tasks']} tasks, {stage['frames']} frames"
                        )
                        if stage["datasets"]:
                            st.caption(
                                "Datasets: " + ", ".join(stage["datasets"])
                            )

    # ── Apply ────────────────────────────────────────────────────────────
    if apply_btn and raw_text.strip():
        parsed = parse_slack_message(raw_text)
        if not parsed:
            st.error("Nothing to apply — no partner blocks found.")
            return

        with st.spinner("Processing…"):
            stats = process_parser_results(session, parsed)
            session.commit()

        st.success("✅ Database updated successfully!")

        m1, m2, m3 = st.columns(3)
        m1.metric("Installs Touched", len(stats["installs_touched"]))
        m2.metric("Stage Records Created", stats["stages_created"])
        m3.metric("Errors", len(stats["errors"]))

        if stats["installs_touched"]:
            with st.expander("Installs touched"):
                st.write(", ".join(sorted(stats["installs_touched"])))

        if stats["errors"]:
            with st.expander("⚠️ Errors"):
                for e in stats["errors"]:
                    st.error(e)
