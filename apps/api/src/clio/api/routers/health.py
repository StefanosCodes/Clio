from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"status": "live"}


@router.get("/health/ready")
async def readiness() -> dict[str, object]:
    return {
        "status": "ready",
        "dependencies": [
            {"name": "foundation_runtime", "status": "ready"},
            {"name": "database", "status": "not_required"},
            {"name": "openai", "status": "not_required"},
        ],
    }
