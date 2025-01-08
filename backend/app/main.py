from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.database import get_db

app = FastAPI(title="ChatGenius API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root(db: Session = Depends(get_db)):
    return {"message": "Welcome to ChatGenius API"}

# Add this to create tables on startup
from app.models.base import Base, engine
Base.metadata.create_all(bind=engine) 