"""
Build Mode Graph — LangGraph StateGraph wiring.
Nodes: intent → context → clarify? → recommend → validate → apply → summarize
"""

import uuid
from langgraph.graph import StateGraph, END
from .state import BuildState
from .nodes import (
    intent_classify,
    gather_context,
    clarify,
    recommend,
    validate_rules,
    apply_changes,
    summarize,
)

# ── In-memory session store ───────────────────────────────────
build_sessions: dict[str, BuildState] = {}


def _should_clarify(state: BuildState) -> str:
    """Route after clarify node: if needs_clarification → interrupt, else → recommend."""
    if state.get("needs_clarification") and not state.get("clarification_answer"):
        return "interrupt"
    return "recommend"


def _should_apply(state: BuildState) -> str:
    """Route after validate: if valid → apply, else → summarize with errors."""
    if state.get("is_valid"):
        return "apply"
    retries = state.get("retries", 0)
    if retries < 2:
        return "retry_recommend"
    return "summarize"


# ── Build the graph ───────────────────────────────────────────
def _create_graph() -> StateGraph:
    g = StateGraph(BuildState)

    g.add_node("intent", intent_classify)
    g.add_node("context", gather_context)
    g.add_node("clarify", clarify)
    g.add_node("recommend", recommend)
    g.add_node("validate", validate_rules)
    g.add_node("apply", apply_changes)
    g.add_node("summarize", summarize)

    g.set_entry_point("intent")
    g.add_edge("intent", "context")
    g.add_edge("context", "clarify")

    g.add_conditional_edges("clarify", _should_clarify, {
        "interrupt": END,
        "recommend": "recommend",
    })

    g.add_edge("recommend", "validate")

    g.add_conditional_edges("validate", _should_apply, {
        "apply": "apply",
        "retry_recommend": "recommend",
        "summarize": "summarize",
    })

    g.add_edge("apply", "summarize")
    g.add_edge("summarize", END)

    return g


graph = _create_graph().compile()


# ── Entry points called by app.py ─────────────────────────────
async def handle_build(
    user_message: str,
    catalog: dict,
    current_selections: dict | None = None,
) -> dict:
    """Start a new build conversation."""
    session_id = str(uuid.uuid4())[:8]

    initial_state: BuildState = {
        "session_id": session_id,
        "user_message": user_message,
        "catalog": catalog,
        "model_data": list(catalog.get("models", {}).values())[0] if catalog.get("models") else {},
        "current_selections": current_selections or {},
        "parsed_request": "",
        "budget": None,
        "catalog_context": "",
        "available_options": [],
        "needs_clarification": False,
        "clarification_question": "",
        "clarification_answer": "",
        "proposed_changes": [],
        "recommendation_text": "",
        "retries": 0,
        "is_valid": False,
        "validation_errors": [],
        "price_delta": 0,
        "needs_confirmation": False,
        "confirmation": False,
        "applied": False,
        "final_selections": {},
        "summary": "",
        "error": "",
    }

    result = await graph.ainvoke(initial_state)

    # If the graph stopped at clarification, save session for resume
    if result.get("needs_clarification") and not result.get("applied"):
        build_sessions[session_id] = result
        return {
            "session_id": session_id,
            "text": result.get("clarification_question", "Could you tell me more about what you'd like?"),
            "proposed_changes": [],
            "needs_clarification": True,
            "applied": False,
        }

    # Normal completion — return proposed changes for UI confirmation
    if result.get("applied"):
        return {
            "session_id": session_id,
            "text": result.get("summary", "Changes applied."),
            "proposed_changes": result.get("proposed_changes", []),
            "needs_clarification": False,
            "applied": True,
            "final_selections": result.get("final_selections", {}),
        }

    # Proposed but not yet applied (needs user confirmation)
    build_sessions[session_id] = result
    return {
        "session_id": session_id,
        "text": result.get("recommendation_text") or result.get("summary", "Here are my recommendations."),
        "proposed_changes": result.get("proposed_changes", []),
        "needs_confirmation": not result.get("applied", False),
        "needs_clarification": False,
        "applied": False,
    }


async def resume_build(session_id: str, user_answer: str) -> dict:
    """Resume a build session after clarification or confirmation."""
    saved = build_sessions.pop(session_id, None)
    if not saved:
        return {
            "session_id": session_id,
            "text": "Session expired. Please start a new request.",
            "proposed_changes": [],
            "applied": False,
        }

    # Was it a clarification answer?
    if saved.get("needs_clarification"):
        saved["clarification_answer"] = user_answer
        saved["needs_clarification"] = False
        result = await graph.ainvoke(saved)
    else:
        # Confirmation: user said yes/no
        affirm = user_answer.strip().lower() in ("yes", "y", "ok", "confirm", "sure", "apply", "go ahead", "do it")
        if affirm:
            saved["confirmation"] = True
            # Apply changes directly
            from .nodes import apply_changes, summarize
            apply_result = await apply_changes(saved)
            saved.update(apply_result)
            sum_result = await summarize(saved)
            saved.update(sum_result)
            result = saved
        else:
            result = {**saved, "summary": "No problem! Changes were not applied. Let me know if you'd like something else.", "applied": False}

    sid = result.get("session_id", session_id)
    return {
        "session_id": sid,
        "text": result.get("summary") or result.get("recommendation_text", "Done."),
        "proposed_changes": result.get("proposed_changes", []),
        "needs_clarification": result.get("needs_clarification", False),
        "applied": result.get("applied", False),
        "final_selections": result.get("final_selections", {}),
    }
