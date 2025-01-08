class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    avatar_url = Column(String)
    status = Column(String, default="active")  # active, away, offline
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime)
    
    # AI Avatar settings
    ai_avatar_enabled = Column(Boolean, default=False)
    ai_avatar_settings = Column(JSON)  # Store personality, voice, appearance preferences


class Channel(Base):
    __tablename__ = "channels"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(String)
    is_private = Column(Boolean, default=False)
    created_by = Column(UUID, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    members = relationship("ChannelMember", back_populates="channel")


class ChannelMember(Base):
    __tablename__ = "channel_members"
    
    channel_id = Column(UUID, ForeignKey("channels.id"), primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"), primary_key=True)
    role = Column(String, default="member")  # admin, member
    joined_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    channel = relationship("Channel", back_populates="members")
    user = relationship("User")


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    channel_id = Column(UUID, ForeignKey("channels.id"))
    user_id = Column(UUID, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, default=False)
    parent_id = Column(UUID, ForeignKey("messages.id"), nullable=True)  # For threads
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    reactions = relationship("MessageReaction")
    attachments = relationship("MessageAttachment")
    thread_messages = relationship("Message")


class MessageReaction(Base):
    __tablename__ = "message_reactions"
    
    message_id = Column(UUID, ForeignKey("messages.id"), primary_key=True)
    user_id = Column(UUID, ForeignKey("users.id"), primary_key=True)
    emoji = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MessageAttachment(Base):
    __tablename__ = "message_attachments"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID, ForeignKey("messages.id"))
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_url = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DirectMessage(Base):
    __tablename__ = "direct_messages"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    sender_id = Column(UUID, ForeignKey("users.id"))
    recipient_id = Column(UUID, ForeignKey("users.id"))
    content = Column(Text, nullable=False)
    is_ai_generated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    
    # Relationships
    attachments = relationship("DirectMessageAttachment")


class AIContext(Base):
    __tablename__ = "ai_contexts"
    
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID, ForeignKey("users.id"))
    context_type = Column(String)  # conversation, personality, preferences
    content = Column(JSON)
    embedding = Column(Vector)  # For similarity search
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)