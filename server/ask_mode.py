"""
Ask Mode — Stateless Q&A powered by Anthropic Claude.
Stuffs the boat catalog into the system prompt and answers questions.
Falls back to OpenAI then Gemini if Anthropic fails.
"""

import os, json, re
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

anthropic_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _build_catalog_context(catalog: dict, model_data: dict | None, selections: dict) -> str:
    """Build a compact catalog string for the system prompt."""
    lines = []
    lines.append("=== STINGRAY BOATS PRODUCT CATALOG ===\n")

    # Models
    for slug, m in catalog["models"].items():
        lines.append(f"MODEL: {m['name']} (slug: {slug})")
        lines.append(f"  Category: {m['category']}")
        lines.append(f"  Base Price: ${m['base_price']:,}  |  MSRP: ${m['msrp']:,}")
        lines.append(f"  Specs: {json.dumps(m['specs'])}")
        lines.append(f"  Best For: {m['best_for']}")
        lines.append(f"  Description: {m['description']}\n")

    # Option groups
    lines.append("=== OPTION GROUPS & PRICING ===\n")
    for gk, g in catalog["option_groups"].items():
        lines.append(f"GROUP: {g['label']} (key: {gk}, section: {g['section']}, type: {g['type']})")
        for opt in g["options"]:
            default = " [DEFAULT]" if opt.get("default") else ""
            price = f"${opt['price']:,}" if opt["price"] else "Included"
            extra = ""
            if opt.get("engine_req"):
                extra = f" (requires {opt['engine_req']} engine)"
            lines.append(f"  - {opt['id']}: {opt['label']} — {price}{default}{extra}")
        lines.append("")

    # Standard features
    lines.append("=== STANDARD FEATURES (included) ===")
    for f in catalog.get("standard_features", []):
        lines.append(f"  • {f}")

    # Current selections
    if selections:
        lines.append("\n=== CUSTOMER'S CURRENT SELECTIONS ===")
        lines.append(json.dumps(selections, indent=2))

    return "\n".join(lines)


def _build_system_prompt(catalog_context: str) -> str:
    return f"""You are the Stingray Boats AI Assistant — a knowledgeable, friendly boat sales advisor.

ROLE:
- Answer questions about Stingray boat models, options, pricing, specs, and configurations
- Be helpful, accurate, and concise
- When comparing models, use the actual specs and pricing data
- Always reference real prices from the catalog — never make up numbers
- If asked about something not in the catalog, say so honestly
- Keep responses under 200 words unless the user asks for detail
- Use a professional but warm tone

CATALOG DATA:
{catalog_context}

RULES:
- Prices shown are "Stingray One Price" (bundled) — always clarify this
- Engine prices are included in the total build price
- The default engine subtracted for pricing is $48,895 (Yamaha F115XB)
- VX Sport graphics are optional at $830 per set
- Propeller upgrades depend on the engine manufacturer selected
- Interior color upgrade (Cayenne) is $265
- Canvas options are separate add-ons
- Trailer is included; upgrades available"""


async def _ask_anthropic(system: str, message: str) -> str:
    resp = await anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": message}],
    )
    return resp.content[0].text


async def _ask_openai(system: str, message: str) -> str:
    resp = await openai_client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": message},
        ],
    )
    return resp.choices[0].message.content


async def handle_ask(
    message: str,
    catalog: dict,
    model_data: dict | None,
    current_selections: dict,
) -> str:
    """Main ask handler — tries Anthropic first, falls back to OpenAI."""
    catalog_ctx = _build_catalog_context(catalog, model_data, current_selections)
    system = _build_system_prompt(catalog_ctx)

    # Try Anthropic first
    try:
        return await _ask_anthropic(system, message)
    except Exception as e:
        print(f"[ask_mode] Anthropic failed: {e}")

    # Fallback to OpenAI
    try:
        return await _ask_openai(system, message)
    except Exception as e:
        print(f"[ask_mode] OpenAI failed: {e}")

    return "I'm sorry, I'm having trouble connecting to my AI service right now. Please try again in a moment."
