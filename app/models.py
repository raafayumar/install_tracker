"""
FILE: app/models.py
SQLAlchemy ORM models for Install Tracker.
"""

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Boolean, DateTime, Date, Text, Enum,
    ForeignKey, JSON, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# ── Enums ────────────────────────────────────────────────────────────────────

class PipelineType(str, enum.Enum):
    OB = "OB"
    PPE = "PPE"


class ActivityType(str, enum.Enum):
    STAGE_UPDATE = "stage_update"
    COMMENT = "comment"
    SUMMARY = "summary"
    PARSER_UPDATE = "parser_update"


# ── Users ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, name='{self.name}')>"


# ── Installs ─────────────────────────────────────────────────────────────────

class Install(Base):
    __tablename__ = "installs"

    comp_site_id = Column(String(50), primary_key=True)   # e.g. "150-936"
    owner_name = Column(String(255), nullable=True)
    site_name = Column(String(255), nullable=True)
    jira_link = Column(String(512), nullable=True)
    install_type = Column(String(50), default="New Site")  # "New Site" | "AddOn"
    region = Column(String(50), default="US")  # US | EU | CA | Tesla | Asia
    status = Column(String(50), default="In-progress")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Model evaluation — user ticks these if general model eval passed
    general_od_model = Column(Boolean, default=False)
    general_ppe_model = Column(Boolean, default=False)

    # Deployment confirmation
    ob_deployed = Column(Boolean, default=False)
    ppe_deployed = Column(Boolean, default=False)

    # Dates
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # relationships
    pipelines = relationship("Pipeline", back_populates="install",
                             cascade="all, delete-orphan")
    activities = relationship("InstallActivity", back_populates="install",
                              cascade="all, delete-orphan",
                              order_by="InstallActivity.created_at.desc()")

    def __repr__(self):
        return f"<Install(comp_site_id='{self.comp_site_id}')>"


# ── Pipelines ────────────────────────────────────────────────────────────────

class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comp_site_id = Column(String(50), ForeignKey("installs.comp_site_id",
                                                  ondelete="CASCADE"),
                          nullable=False)
    pipeline_type = Column(Enum(PipelineType), nullable=False)
    partner = Column(String(255), nullable=True)
    data_status = Column(String(20), default="active")  # "active" | "no_data"

    __table_args__ = (
        UniqueConstraint("comp_site_id", "pipeline_type",
                         name="uq_pipeline_comp_type"),
    )

    # relationships
    install = relationship("Install", back_populates="pipelines")
    stages = relationship("PipelineStage", back_populates="pipeline",
                          cascade="all, delete-orphan",
                          order_by="PipelineStage.updated_at.desc()")

    def __repr__(self):
        return (f"<Pipeline(id={self.id}, comp_site_id='{self.comp_site_id}', "
                f"type={self.pipeline_type})>")


# ── Pipeline Stages ──────────────────────────────────────────────────────────

class PipelineStage(Base):
    __tablename__ = "pipeline_stages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id",
                                              ondelete="CASCADE"),
                         nullable=False)
    stage_name = Column(String(100), nullable=False)
    tasks = Column(Integer, default=0)
    frames = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # relationships
    pipeline = relationship("Pipeline", back_populates="stages")

    def __repr__(self):
        return (f"<PipelineStage(id={self.id}, stage='{self.stage_name}', "
                f"active={self.active})>")


# ── Stage Snapshots (aggregate per partner+stage per batch) ──────────────────

class StageSnapshot(Base):
    __tablename__ = "stage_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(50), nullable=False, index=True)
    partner = Column(String(255), nullable=False)
    pipeline_type = Column(Enum(PipelineType), nullable=False)
    stage_name = Column(String(100), nullable=False)
    tasks = Column(Integer, default=0)
    frames = Column(Integer, default=0)
    datasets = Column(JSON, nullable=True)  # list of comp_site_ids
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return (f"<StageSnapshot(id={self.id}, batch='{self.batch_id}', "
                f"partner='{self.partner}', stage='{self.stage_name}')>")


# ── Site Stage History (per-site presence per batch) ─────────────────────────

class SiteStageHistory(Base):
    __tablename__ = "site_stage_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(50), nullable=False, index=True)
    comp_site_id = Column(String(50), ForeignKey("installs.comp_site_id",
                                                  ondelete="CASCADE"),
                          nullable=False, index=True)
    partner = Column(String(255), nullable=False)
    pipeline_type = Column(Enum(PipelineType), nullable=False)
    stage_name = Column(String(100), nullable=False)
    frames = Column(Integer, nullable=True)  # NULL for now, per-site frames coming later
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # relationships
    install = relationship("Install")

    def __repr__(self):
        return (f"<SiteStageHistory(id={self.id}, batch='{self.batch_id}', "
                f"site='{self.comp_site_id}', stage='{self.stage_name}')>")


# ── Install Activity ─────────────────────────────────────────────────────────

class InstallActivity(Base):
    __tablename__ = "install_activity"

    id = Column(Integer, primary_key=True, autoincrement=True)
    comp_site_id = Column(String(50), ForeignKey("installs.comp_site_id",
                                                  ondelete="CASCADE"),
                          nullable=False)
    user_name = Column(String(255), nullable=True)
    activity_type = Column(Enum(ActivityType), nullable=False)
    message = Column(Text, nullable=True)
    metadata_ = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # relationships
    install = relationship("Install", back_populates="activities")

    def __repr__(self):
        return (f"<InstallActivity(id={self.id}, type={self.activity_type}, "
                f"comp_site_id='{self.comp_site_id}')>")
