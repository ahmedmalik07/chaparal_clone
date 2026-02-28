"""
Build Mode State — TypedDict definitions for the LangGraph agent.
"""

from typing import TypedDict, Optional


class ToolCall(TypedDict, total=False):
    """A single proposed configuration change."""
    action: str          # "select" | "deselect" | "add" | "remove"
    option_id: str       # e.g. "eng-yamaha-150"
    group_key: str       # e.g. "engine"
    label: str           # human-readable label
    price: int           # price of this option
    reason: str          # why we're recommending this


class BuildState(TypedDict, total=False):
    """Full state for the build agent graph."""
    # Input
    session_id: str
    user_message: str
    catalog: dict
    model_data: dict
    current_selections: dict

    # Intent
    parsed_request: str
    budget: int | None

    # Context
    catalog_context: str
    available_options: list

    # Clarification
    needs_clarification: bool
    clarification_question: str
    clarification_answer: str

    # Recommendation
    proposed_changes: list        # list[ToolCall]
    recommendation_text: str
    retries: int

    # Validation
    is_valid: bool
    validation_errors: list
    price_delta: int

    # Confirmation
    needs_confirmation: bool
    confirmation: str             # "yes" | "no" | ""

    # Application
    applied: bool
    final_selections: dict

    # Summary
    summary: str
    error: str
