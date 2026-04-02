"""
FILE: app/main.py
Streamlit entry point for Install Tracker.
"""

import streamlit as st

from app.db import init_db, get_session
from app.services import list_users, get_or_create_user
from app.dashboard import render_dashboard
from app.admin_view import render_admin_view
from app.analytics import render_analytics

# ── Page config ──────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Install Tracker",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Init DB on first run ─────────────────────────────────────────────────────

if "db_initialised" not in st.session_state:
    init_db()
    with get_session() as s:
        users = list_users(s)
        if not users:
            for name in ["Raafay"]:
                get_or_create_user(s, name)
    st.session_state.db_initialised = True

# ── Sidebar ──────────────────────────────────────────────────────────────────

st.sidebar.title("Install Tracker")
st.sidebar.divider()

with get_session() as sess:
    user_list = [u.name for u in list_users(sess)]

view_options = ["All"] + user_list + ["📊 Analytics", "— Admin Update —"]

# Read query param to preserve view when clicking install links
qp = st.query_params
default_idx = 0
if "view" in qp:
    target_view = qp["view"]
    if target_view in view_options:
        default_idx = view_options.index(target_view)

selected = st.sidebar.selectbox("Select View", view_options, index=default_idx)

st.sidebar.divider()
with st.sidebar.expander("Manage Team Members"):
    new_user = st.text_input("Add team member", key="new_user_input")
    if st.button("Add", key="add_user_btn") and new_user.strip():
        with get_session() as s:
            get_or_create_user(s, new_user.strip())
        st.success(f"Added {new_user.strip()}")
        st.rerun()

# ── Main content ─────────────────────────────────────────────────────────────

if selected == "— Admin Update —":
    with get_session() as sess:
        render_admin_view(sess)
elif selected == "📊 Analytics":
    with get_session() as sess:
        render_analytics(sess)
else:
    with get_session() as sess:
        render_dashboard(sess, selected)
