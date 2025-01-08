from sqlalchemy import create_engine
engine = create_engine('postgresql://postgres:mango888@localhost:5432/chatgenius')
try:
    connection = engine.connect()
    print("Successfully connected to PostgreSQL!")
    connection.close()
except Exception as e:
    print("Connection failed:", e)