from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import channel, jobs

app = FastAPI(title="ClipForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(channel.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")

@app.get("/")
def health():
    return {"status": "ok"}
