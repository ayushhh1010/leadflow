import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .api import router as leads_router
from .config import settings
from .db import DbSession
from .service import NotFoundError

logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(
    title="LeadFlow API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)
app.include_router(leads_router)


@app.exception_handler(NotFoundError)
async def handle_not_found(_request: Request, exc: NotFoundError) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(Exception)
async def handle_unexpected(_request: Request, _exc: Exception) -> JSONResponse:
    # The server still logs the traceback; clients never see internals.
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health", tags=["meta"])
def health(db: DbSession) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok"}
