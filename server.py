"""
TrustAid OpenEnv — FastAPI Backend Server
==========================================
Accepts both GET and POST on /openenv/reset so that
checkers that ping with GET first don't get Method Not Allowed.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os

from environment import TrustAidPOMDP, Action, ActionType, SCENARIOS

app = FastAPI(title="TrustAid OpenEnv", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

env: Optional[TrustAidPOMDP] = None


# ── Request schemas ───────────────────────────────────────────────────────────

class ResetRequest(BaseModel):
    scenario_id: str = "medium_woman_safety"


class StepRequest(BaseModel):
    action_type: str
    content: str
    target_fact: Optional[str] = None
    service_id:  Optional[str] = None
    metadata:    Dict[str, Any] = {}


# ══════════════════════════════════════════════════════════════════════════════
# OpenEnv API routes
# Using api_route to accept BOTH GET and POST — some checkers ping with GET
# ══════════════════════════════════════════════════════════════════════════════

@app.api_route("/openenv/reset", methods=["GET", "POST"])
async def openenv_reset(request: Request):
    """Reset environment — accepts GET and POST."""
    global env

    # Parse body if POST with JSON, otherwise use defaults
    scenario_id = "medium_woman_safety"
    if request.method == "POST":
        try:
            body = await request.json()
            scenario_id = body.get("scenario_id", "medium_woman_safety")
        except Exception:
            pass  # no body or non-JSON body — use default

    if scenario_id not in SCENARIOS:
        scenario_id = "medium_woman_safety"

    env = TrustAidPOMDP()
    observation = env.reset(scenario_id=scenario_id)

    return {
        "status": "ok",
        "scenario_id": scenario_id,
        "observation": observation.model_dump(),
    }


@app.api_route("/openenv/step", methods=["GET", "POST"])
async def openenv_step(request: Request):
    """Execute one action step."""
    global env
    if env is None:
        raise HTTPException(status_code=400, detail="Call /openenv/reset first.")

    if request.method == "POST":
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid JSON body.")
    else:
        # GET with no body — return current state info
        return {"status": "ok", "message": "Send POST with action to step."}

    try:
        action = Action(
            action_type=ActionType(body.get("action_type", "ask_question")),
            content=body.get("content", "Hello"),
            target_fact=body.get("target_fact"),
            service_id=body.get("service_id"),
            metadata=body.get("metadata", {}),
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid action: {e}")

    result = env.step(action)
    return result.model_dump()


@app.api_route("/openenv/validate", methods=["GET", "POST"])
def openenv_validate():
    """Health-check endpoint."""
    return {
        "status": "ok",
        "version": "3.0.0",
        "scenarios": list(SCENARIOS.keys()),
        "env_ready": env is not None,
    }

# Short routes — Scaler checker uses /reset not /openenv/reset
@app.api_route("/reset", methods=["GET", "POST"])
async def reset_short(request: Request):
    return await openenv_reset(request)

@app.api_route("/step", methods=["GET", "POST"])
async def step_short(request: Request):
    return await openenv_step(request)

@app.get("/validate")
def validate_short():
    return openenv_validate()
# ══════════════════════════════════════════════════════════════════════════════
# Serve React frontend — AFTER all API routes
# ══════════════════════════════════════════════════════════════════════════════

DIST_DIR = os.path.join(os.path.dirname(__file__), "dist")

if os.path.isdir(DIST_DIR):
    assets_dir = os.path.join(DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_index():
        return FileResponse(os.path.join(DIST_DIR, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("openenv"):
            raise HTTPException(status_code=404)
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(DIST_DIR, "index.html"))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)