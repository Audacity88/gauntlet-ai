-- Enable the pgvector extension
create extension if not exists vector;

-- Create helper functions
create or replace function array_to_vector(arr float[])
returns vector
language plpgsql
as $$
begin
    return arr::vector;
end;
$$;

-- Create tables for RAG system
create table message_chunks (
    id uuid primary key default gen_random_uuid(),
    message_id uuid references messages(id) on delete cascade,
    dm_message_id uuid references direct_messages(id) on delete cascade,
    chunk_index int not null,
    chunk_content text not null,
    metadata jsonb,
    created_at timestamptz default now(),
    check (
        (message_id is not null and dm_message_id is null) or
        (message_id is null and dm_message_id is not null)
    )
);

create table message_embeddings (
    id uuid primary key default gen_random_uuid(),
    chunk_id uuid references message_chunks(id) on delete cascade,
    embedding_vector vector(1536), -- OpenAI's ada-002 dimension
    created_at timestamptz default now()
);

create table rag_queries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    query_text text not null,
    retrieved_chunks jsonb,
    response_text text,
    latency_ms int,
    feedback_score int check (feedback_score >= 1 and feedback_score <= 5),
    created_at timestamptz default now()
);

-- Create indexes for better performance
create index idx_message_chunks_message_id on message_chunks(message_id);
create index idx_message_chunks_dm_message_id on message_chunks(dm_message_id);
create index idx_message_embeddings_chunk_id on message_embeddings(chunk_id);
create index idx_rag_queries_user_id on rag_queries(user_id);
create index idx_rag_queries_created_at on rag_queries(created_at);

-- Create a function to search similar messages
create or replace function search_similar_messages(
    query_embedding vector(1536),
    match_threshold float,
    match_count int
)
returns table (
    chunk_id uuid,
    message_id uuid,
    dm_message_id uuid,
    content text,
    similarity float
)
language sql stable
as $$
    select
        c.id as chunk_id,
        c.message_id,
        c.dm_message_id,
        c.chunk_content as content,
        1 - (e.embedding_vector <=> query_embedding) as similarity
    from message_embeddings e
    join message_chunks c on c.id = e.chunk_id
    where 1 - (e.embedding_vector <=> query_embedding) > match_threshold
    order by e.embedding_vector <=> query_embedding
    limit match_count;
$$;

-- Add RLS policies
alter table message_chunks enable row level security;
alter table message_embeddings enable row level security;
alter table rag_queries enable row level security;

-- Message chunks policies
create policy "Message chunks are viewable by channel members"
    on message_chunks for select
    using (
        (message_id is not null and exists (
            select 1 from channel_members
            where channel_members.channel_id = (
                select channel_id from messages where id = message_chunks.message_id
            )
            and channel_members.user_id = auth.uid()
        ))
        or
        (dm_message_id is not null and exists (
            select 1 from direct_message_members
            where direct_message_members.channel_id = (
                select channel_id from direct_messages where id = message_chunks.dm_message_id
            )
            and direct_message_members.user_id = auth.uid()
        ))
    );

-- Message embeddings policies
create policy "Message embeddings are viewable by channel members"
    on message_embeddings for select
    using (
        exists (
            select 1 from message_chunks c
            where c.id = message_embeddings.chunk_id
            and (
                (c.message_id is not null and exists (
                    select 1 from channel_members
                    where channel_members.channel_id = (
                        select channel_id from messages where id = c.message_id
                    )
                    and channel_members.user_id = auth.uid()
                ))
                or
                (c.dm_message_id is not null and exists (
                    select 1 from direct_message_members
                    where direct_message_members.channel_id = (
                        select channel_id from direct_messages where id = c.dm_message_id
                    )
                    and direct_message_members.user_id = auth.uid()
                ))
            )
        )
    );

-- RAG queries policies
create policy "Users can view their own RAG queries"
    on rag_queries for select
    using (auth.uid() = user_id);

create policy "Users can insert their own RAG queries"
    on rag_queries for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own RAG queries"
    on rag_queries for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id); 