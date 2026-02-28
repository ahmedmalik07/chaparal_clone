"""
Build Mode Nodes — The 7 async functions that make up the LangGraph agent.
Each node receives and returns a partial BuildState dict.
Optimised: only ONE LLM call (recommend), eliminated LangGraph overhead.
"""

import os, re, json
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from .state import BuildState, ToolCall

anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Models ────────────────────────────────────────────────────
_ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
_OPENAI_MODEL = "gpt-4o"


# ── Helpers ───────────────────────────────────────────────────
def _catalog_to_text(catalog: dict) -> str:
    """Compact catalog representation for LLM context."""
    lines = []
    for gk, g in catalog["option_groups"].items():
        lines.append(f"\nGROUP: {g['label']} (key: {gk}, section: {g['section']}, type: {g['type']})")
        for opt in g["options"]:
            price = f"${opt['price']:,}" if opt["price"] else "Included"
            default = " [DEFAULT]" if opt.get("default") else ""
            extra = f" (requires {opt['engine_req']})" if opt.get("engine_req") else ""
            lines.append(f"  {opt['id']}: {opt['label']} — {price}{default}{extra}")
    return "\n".join(lines)


async def _llm(system: str, user: str, expect_json: bool = False) -> str:
    """Call LLM — tries Anthropic first, falls back to OpenAI."""
    text = None

    # Try Anthropic first
    try:
        resp = await anthropic_client.messages.create(
            model=_ANTHROPIC_MODEL,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = resp.content[0].text.strip()
    except Exception as e:
        print(f"[build] Anthropic failed: {e}")

    # Fallback to OpenAI
    if text is None:
        try:
            resp = await openai_client.chat.completions.create(
                model=_OPENAI_MODEL,
                max_tokens=4096,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            text = resp.choices[0].message.content.strip()
        except Exception as e:
            print(f"[build] OpenAI also failed: {e}")
            raise RuntimeError("Both AI providers failed. Please check your API keys.")

    if expect_json:
        # Extract JSON from possible markdown code fences
        if "```" in text:
            start = text.find("```")
            end = text.rfind("```")
            text = text[start:end].split("\n", 1)[-1] if end > start else text
        text = text.strip().strip("`").strip()
        if text.startswith("json"):
            text = text[4:].strip()
    return text


# ── Node 1: Parse Intent (NO LLM — fast keyword parsing) ─────
async def intent_classify(state: BuildState) -> dict:
    """Fast keyword-based intent parsing. No LLM call needed."""
    msg = state["user_message"]
    lower = msg.lower()

    # Extract budget if mentioned (e.g. "budget $50000", "under 40k", "$30,000 max")
    budget = None
    m = re.search(r'(?:budget|max|limit|under|below|within)\s*\$?([\d,]+)\s*k?', lower)
    if m:
        val = int(m.group(1).replace(",", ""))
        budget = val * 1000 if val < 1000 else val
    else:
        m = re.search(r'\$\s*([\d,]+)\s*k?', lower)
        if m:
            val = int(m.group(1).replace(",", ""))
            budget = val * 1000 if val < 1000 else val

    return {
        "parsed_request": msg,
        "budget": budget,
        "needs_clarification": False,   # always clear — let recommend handle ambiguity
    }


# ── Node 2: Gather Context ───────────────────────────────────
async def gather_context(state: BuildState) -> dict:
    """Load catalog context and available options."""
    catalog = state["catalog"]
    ctx = _catalog_to_text(catalog)

    # Build flat list of all available options
    available = []
    for gk, g in catalog["option_groups"].items():
        for opt in g["options"]:
            available.append({
                "group_key": gk,
                "group_label": g["label"],
                "group_type": g["type"],
                **opt
            })

    return {
        "catalog_context": ctx,
        "available_options": available,
    }


# ── Node 3: Clarify ──────────────────────────────────────────
async def clarify(state: BuildState) -> dict:
    """Skip clarification — intent_classify always marks requests as clear."""
    if not state.get("needs_clarification"):
        return {"needs_clarification": False}

    # If user already answered a previous clarification
    if state.get("clarification_answer"):
        return {
            "needs_clarification": False,
            "parsed_request": state["parsed_request"] + " — User clarified: " + state["clarification_answer"],
        }

    # Fallback: generate a quick clarifying question (only if explicitly flagged)
    return {
        "needs_clarification": True,
        "clarification_question": "Could you tell me more about what you'd like to configure?",
    }


# ── Node 4: Recommend ────────────────────────────────────────
async def recommend(state: BuildState) -> dict:
    """Generate proposed configuration changes."""
    system = f"""You are a boat configurator AI. Based on the user's request and the available options,
propose specific configuration changes.

CATALOG:
{state['catalog_context']}

CURRENT SELECTIONS:
{json.dumps(state.get('current_selections', {}), indent=2)}

Respond ONLY with JSON array of changes. Each change:
{{
  "action": "select" | "deselect" | "add" | "remove",
  "option_id": "the exact option id from catalog",
  "group_key": "the group key",
  "label": "human readable label",
  "price": price_as_integer,
  "reason": "brief reason for this recommendation"
}}

RULES:
- For single_required groups: use "select" (replaces current)
- For multi_optional groups: use "add" to add, "remove" to remove
- Only recommend options that exist in the catalog
- If user wants cheapest/most affordable, pick lowest-price options
- If user mentions a budget, stay within it
- Propeller upgrades must match the selected engine manufacturer"""

    user = f"User wants: {state['parsed_request']}"
    if state.get("budget"):
        user += f"\nBudget: ${state['budget']:,}"

    text = await _llm(system, user, expect_json=True)

    try:
        changes = json.loads(text)
        if not isinstance(changes, list):
            changes = [changes]
    except json.JSONDecodeError:
        # Try to salvage truncated JSON — find last complete object
        try:
            last_brace = text.rfind("}")
            if last_brace > 0:
                truncated = text[:last_brace + 1] + "]"
                changes = json.loads(truncated)
                if not isinstance(changes, list):
                    changes = [changes]
            else:
                raise ValueError("No valid JSON found")
        except (json.JSONDecodeError, ValueError):
            return {
                "proposed_changes": [],
                "recommendation_text": "I couldn't generate specific recommendations. Could you rephrase your request?",
                "is_valid": False,
            }

    # Build recommendation text
    lines = ["Here's what I recommend:\n"]
    total_delta = 0
    for c in changes:
        price = c.get("price", 0)
        lines.append(f"• **{c.get('action', 'select').title()}** {c.get('label', c.get('option_id', '?'))} — ${price:,}")
        lines.append(f"  _{c.get('reason', '')}_")
        if c.get("action") in ("select", "add"):
            total_delta += price
        elif c.get("action") in ("deselect", "remove"):
            total_delta -= price

    lines.append(f"\nEstimated price impact: ${total_delta:+,}")

    return {
        "proposed_changes": changes,
        "recommendation_text": "\n".join(lines),
        "price_delta": total_delta,
        "retries": state.get("retries", 0) + 1,   # ← FIX: increment to prevent infinite retry loop
    }


# ── Node 5: Validate ─────────────────────────────────────────
async def validate_rules(state: BuildState) -> dict:
    """Validate proposed changes against catalog rules."""
    errors = []
    catalog = state["catalog"]
    changes = state.get("proposed_changes", [])

    if not changes:
        return {"is_valid": False, "validation_errors": ["No changes proposed"]}

    valid_ids = set()
    for g in catalog["option_groups"].values():
        for opt in g["options"]:
            valid_ids.add(opt["id"])

    for c in changes:
        oid = c.get("option_id", "")
        if oid not in valid_ids:
            errors.append(f"Unknown option: {oid}")

        # Check engine-prop compatibility
        if c.get("group_key") == "propeller":
            opt_data = None
            for opt in catalog["option_groups"].get("propeller", {}).get("options", []):
                if opt["id"] == oid:
                    opt_data = opt
                    break
            if opt_data and opt_data.get("engine_req"):
                current_engine = state.get("current_selections", {}).get("engine", "eng-yamaha-115")
                engine_mfg = "yamaha" if "yamaha" in current_engine else "mercury"
                # Check if proposed changes include an engine change
                for other_c in changes:
                    if other_c.get("group_key") == "engine":
                        eng_opt = next((o for o in catalog["option_groups"]["engine"]["options"] if o["id"] == other_c["option_id"]), None)
                        if eng_opt:
                            engine_mfg = eng_opt.get("mfg", engine_mfg)
                if opt_data["engine_req"] != engine_mfg:
                    errors.append(f"Prop {oid} requires {opt_data['engine_req']} engine but {engine_mfg} is selected")

    return {
        "is_valid": len(errors) == 0,
        "validation_errors": errors,
    }


# ── Node 6: Apply ────────────────────────────────────────────
async def apply_changes(state: BuildState) -> dict:
    """Apply confirmed changes to selections."""
    selections = dict(state.get("current_selections", {}))
    if "checkboxes" not in selections:
        selections["checkboxes"] = {}

    for c in state.get("proposed_changes", []):
        gk = c.get("group_key", "")
        oid = c.get("option_id", "")
        action = c.get("action", "select")

        # Map group keys to selection keys
        key_map = {
            "white-hull": "whiteHull",
            "hull-side": "hullSide",
            "vx-sport": "vxSport",
            "engine": "engine",
            "interior-color": "interior",
            "canvas-color": "canvasColor",
            "trailer": "trailer",
        }

        if gk in key_map:
            if action in ("select",):
                selections[key_map[gk]] = oid
            elif action in ("deselect", "remove"):
                selections[key_map[gk]] = None
        else:
            # Checkbox-type groups
            if action in ("add", "select"):
                selections["checkboxes"][oid] = True
            elif action in ("remove", "deselect"):
                selections["checkboxes"][oid] = False

    return {
        "applied": True,
        "final_selections": selections,
    }


# ── Node 7: Summarize ────────────────────────────────────────
async def summarize(state: BuildState) -> dict:
    """Generate a human-friendly summary of what was done."""
    if state.get("error"):
        return {"summary": f"Sorry, I ran into an issue: {state['error']}"}

    if not state.get("applied"):
        if state.get("validation_errors"):
            errs = "; ".join(state["validation_errors"])
            return {"summary": f"I couldn't apply those changes due to validation issues: {errs}. Please try a different request."}
        return {"summary": "No changes were applied. Let me know what you'd like to configure!"}

    changes = state.get("proposed_changes", [])
    lines = ["Done! Here's what I changed:\n"]
    for c in changes:
        action_word = {"select": "Selected", "add": "Added", "remove": "Removed", "deselect": "Removed"}.get(c["action"], c["action"])
        lines.append(f"✓ {action_word} **{c.get('label', c['option_id'])}** (${c.get('price', 0):,})")

    price_delta = state.get("price_delta", 0)
    if price_delta:
        lines.append(f"\nPrice impact: ${price_delta:+,}")

    lines.append("\nThe configurator has been updated with your selections.")
    return {"summary": "\n".join(lines)}
