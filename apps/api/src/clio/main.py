import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from clio import __version__
from clio.api.routers.foundation_chat import router as foundation_chat_router
from clio.api.routers.health import router as health_router
from clio.api.routers.application_shell import router as application_shell_router
from clio.application.use_cases import ApplicationShellService
from clio.infrastructure.postgres import ConversationRepository, Database


def create_app(*, database: Database | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        configured_database = database
        if configured_database is None and os.getenv("DATABASE_URL"):
            configured_database = Database(
                os.environ["DATABASE_URL"],
                assume_role=os.getenv("CLIO_DATABASE_ROLE") or None,
            )
        if configured_database is not None:
            await configured_database.connect()
            app.state.application_shell = ApplicationShellService(
                ConversationRepository(configured_database)
            )
        else:
            app.state.application_shell = None
        yield
        if configured_database is not None:
            await configured_database.close()

    app = FastAPI(
        title="Clio API",
        summary="Clio's bounded planning-agent foundation.",
        version=__version__,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["content-type", "last-event-id", "x-clio-organization"],
    )
    app.include_router(health_router)
    app.include_router(foundation_chat_router)
    app.include_router(application_shell_router)

    @app.get("/", tags=["service"])
    async def service_info() -> dict[str, object]:
        return {
            "name": "clio-api",
            "version": __version__,
            "implementation_status": "m1_application_shell",
            "docs": "/docs",
        }

    return app


app = create_app()
