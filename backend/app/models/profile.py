from sqlalchemy import Column, String, Integer
from app.models.base import Base

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    username = Column(String, unique=True, nullable=False)
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)

    def __repr__(self):
        return f"<Profile(username='{self.username}', display_name='{self.display_name}')>" 