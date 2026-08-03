from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from clio import __version__
from clio.api.routers.foundation_chat import router as foundation_chat_router
from clio.api.routers.health import router as health_router


def create_app() -> FastAPI:
    app = FastAPI(
        title="Clio API",
        summary="Clio's bounded planning-agent foundation.",
        version=__version__,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type", "last-event-id"],
    )
    app.include_router(health_router)
    app.include_router(foundation_chat_router)

    @app.get("/", tags=["service"])
    async def service_info() -> dict[str, object]:
        return {
            "name": "clio-api",
            "version": __version__,
            "implementation_status": "m1_foundation",
            "docs": "/docs",
        }

    return app


app = create_app()
