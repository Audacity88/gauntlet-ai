from sqlalchemy import create_engine, text
from app.core.config import settings

def reset_alembic():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        # Drop the alembic_version table if it exists
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))
        conn.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32) PRIMARY KEY)"))
        conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('20240318000009')"))
        conn.commit()

if __name__ == "__main__":
    reset_alembic() 