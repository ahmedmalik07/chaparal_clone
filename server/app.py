"""
Stingray Boats AI Backend — FastAPI server
Provides /ask (Anthropic) and /build (LangGraph) endpoints.
"""

import json, os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from ask_mode import handle_ask
from build_mode.graph import handle_build, resume_build, build_sessions

# ── Load catalog ──────────────────────────────────────────────
CATALOG_PATH = Path(__file__).parent.parent / "data" / "catalog.json"
with open(CATALOG_PATH) as f:
    CATALOG = json.load(f)


# ── App ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[server] Catalog loaded:", len(CATALOG["models"]), "models,",
          len(CATALOG["option_groups"]), "option groups")
    yield

app = FastAPI(title="Stingray Boats AI", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ────────────────────────────────
class AskRequest(BaseModel):
    message: str
    model_slug: str = "19ssiob"
    current_selections: dict = {}

class AskResponse(BaseModel):
    text: str
    provider: str = "anthropic"

class BuildRequest(BaseModel):
    message: str = ""
    model_slug: str = "19ssiob"
    session_id: str | None = None
    current_selections: dict = {}
    answer: str | None = None              # answer to clarification / confirmation

class BuildResponse(BaseModel):
    session_id: str | None = None
    text: str
    proposed_changes: list = []
    needs_confirmation: bool = False
    needs_clarification: bool = False
    applied: bool = False
    final_selections: dict = {}


# ── Endpoints ─────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/ask", response_model=AskResponse)
async def ask_endpoint(req: AskRequest):
    """Stateless Q&A about boats using Anthropic Claude."""
    model_data = CATALOG["models"].get(req.model_slug)
    text = await handle_ask(
        message=req.message,
        catalog=CATALOG,
        model_data=model_data,
        current_selections=req.current_selections,
    )
    return AskResponse(text=text)


@app.post("/build", response_model=BuildResponse)
async def build_endpoint(req: BuildRequest):
    """Stateful boat builder agent using LangGraph."""
    session_id = req.session_id

    # ── Resume flow (clarification or confirmation answer) ──
    if req.answer and session_id and session_id in build_sessions:
        result = await resume_build(session_id, req.answer)
        return BuildResponse(**result)

    # ── New build request ──
    result = await handle_build(
        user_message=req.message,
        catalog=CATALOG,
        current_selections=req.current_selections,
    )
    return BuildResponse(**result)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8090, reload=True)
