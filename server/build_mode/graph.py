"""
Build Mode — Direct async handler (no LangGraph overhead).
Pipeline: intent → context → recommend → validate → apply → summarize
"""

import uuid
from .state import BuildState
from .nodes import (
    intent_classify,
    gather_context,
    recommend,
    validate_rules,
    apply_changes,
    summarize,
)

# ── In-memory session store ───────────────────────────────────
build_sessions: dict[str, BuildState] = {}

MAX_RETRIES = 2


# ── Entry points called by app.py ─────────────────────────────
async def handle_build(
    user_message: str,
    catalog: dict,
    current_selections: dict | None = None,
) -> dict:
    """Start a new build conversation — direct pipeline, no LangGraph."""
    session_id = str(uuid.uuid4())[:8]

    state: BuildState = {
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

    try:
        # Step 1: Parse intent (no LLM — instant)
        state.update(await intent_classify(state))

        # Step 2: Gather catalog context (no LLM — instant)
        state.update(await gather_context(state))

        # Step 3+4: Recommend → Validate (with retry)
        for attempt in range(MAX_RETRIES):
            state.update(await recommend(state))
            state.update(await validate_rules(state))
            if state.get("is_valid"):
                break
            state["retries"] = attempt + 1

        # Step 5: Apply if valid
        if state.get("is_valid"):
            state.update(await apply_changes(state))

        # Step 6: Summarize
        state.update(await summarize(state))

    except Exception as e:
        print(f"[build_mode] Error: {e}")
        state["error"] = str(e)
        state["summary"] = f"Sorry, I ran into an issue: {e}"

    # Build response
    if state.get("applied"):
        return {
            "session_id": session_id,
            "text": state.get("summary", "Changes applied."),
            "proposed_changes": state.get("proposed_changes", []),
            "needs_clarification": False,
            "applied": True,
            "final_selections": state.get("final_selections", {}),
        }

    # Not applied (validation failed or error)
    return {
        "session_id": session_id,
        "text": state.get("summary") or state.get("recommendation_text", "I couldn't complete that request. Please try again."),
        "proposed_changes": state.get("proposed_changes", []),
        "needs_confirmation": False,
        "needs_clarification": False,
        "applied": False,
    }


async def resume_build(session_id: str, user_answer: str) -> dict:
    """Resume a build session after confirmation."""
    saved = build_sessions.pop(session_id, None)
    if not saved:
        return {
            "session_id": session_id,
            "text": "Session expired. Please start a new request.",
            "proposed_changes": [],
            "applied": False,
        }

    affirm = user_answer.strip().lower() in ("yes", "y", "ok", "confirm", "sure", "apply", "go ahead", "do it")
    if affirm:
        saved.update(await apply_changes(saved))
        saved.update(await summarize(saved))
    else:
        saved["summary"] = "No problem! Changes were not applied. Let me know if you'd like something else."
        saved["applied"] = False

    return {
        "session_id": session_id,
        "text": saved.get("summary") or saved.get("recommendation_text", "Done."),
        "proposed_changes": saved.get("proposed_changes", []),
        "needs_clarification": False,
        "applied": saved.get("applied", False),
        "final_selections": saved.get("final_selections", {}),
    }
