from sqlalchemy import create_engine, text
from app.core.config import settings

def check_tables():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        # Check schemas
        result = conn.execute(text("SELECT schema_name FROM information_schema.schemata"))
        print("Schemas:")
        for row in result:
            print(row[0])
        print()

        # Check tables
        result = conn.execute(text("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema IN ('public', 'auth')
            AND table_type = 'BASE TABLE'
        """))
        print("Tables:")
        for row in result:
            print(f"{row[0]}.{row[1]}")
        print()

        # Check views
        result = conn.execute(text("""
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema IN ('public', 'auth')
            AND table_type = 'VIEW'
        """))
        print("Views:")
        for row in result:
            print(f"{row[0]}.{row[1]}")

if __name__ == "__main__":
    check_tables() 