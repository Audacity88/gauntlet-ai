from typing import Dict, Any, AsyncGenerator
import logging
import json
import time
import asyncio
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = """You are an AI avatar that imitates a specific user's personality and writing style. 
Your task is to respond to messages exactly as this user would, based on their past message history.
You should:
1. Match their tone, formality level, and word choice
2. Use similar sentence structures and expressions
3. Maintain their typical message length and formatting style
4. Express opinions and perspectives consistent with their past messages
5. Use emojis, punctuation, and capitalization in the same way they do

Remember: You are not a helpful AI assistant - you are embodying this specific person's digital presence."""

class LLMProcessor:
    """Processes LLM requests for user avatar responses."""
    
    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-3.5-turbo",
        temperature: float = 0.85  # Increased for more creative/human-like responses
    ):
        """Initialize the LLM processor."""
        self.client = AsyncOpenAI(api_key=api_key)
        self.model_name = model_name
        self.temperature = temperature
        
    def _create_prompt(self, query: str, context: str = "", username: str = "") -> str:
        """Create a prompt for the LLM."""
        base_prompt = f"""Here are some example messages from {username} that show their writing style and personality:

{context}

Based on these examples, respond to the following message exactly as {username} would:
Message: {query}

{username}'s response:"""
        return base_prompt
    
    async def generate_rag_response(
        self,
        query: str,
        context: str = "",
        username: str = ""
    ) -> Dict[str, Any]:
        """Generate a response using the LLM."""
        try:
            prompt = self._create_prompt(query, context, username)
            
            if "instruct" in self.model_name:
                # Use completions endpoint for instruct models
                response = await self.client.completions.create(
                    model=self.model_name,
                    prompt=prompt,
                    temperature=self.temperature,
                    max_tokens=1000,
                    top_p=1,
                    frequency_penalty=0.3,  # Added to reduce repetition
                    presence_penalty=0.3    # Added to encourage novel responses
                )
                content = response.choices[0].text.strip()
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            else:
                # Use chat completions endpoint for chat models
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=self.temperature,
                    frequency_penalty=0.3,  # Added to reduce repetition
                    presence_penalty=0.3    # Added to encourage novel responses
                )
                content = response.choices[0].message.content
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            
            return {
                "content": content,
                "model": self.model_name,
                "usage": usage
            }
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            raise Exception(f"Error generating response: {str(e)}")
    
    async def generate_stream_response(
        self,
        query: str,
        context: str = "",
        username: str = ""
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response from the LLM."""
        try:
            prompt = self._create_prompt(query, context, username)
            
            if "instruct" in self.model_name:
                # Use completions endpoint for instruct models
                response = await self.client.completions.create(
                    model=self.model_name,
                    prompt=prompt,
                    temperature=self.temperature,
                    max_tokens=1000,
                    top_p=1,
                    frequency_penalty=0.3,  # Added to reduce repetition
                    presence_penalty=0.3,   # Added to encourage novel responses
                    stream=True
                )
                async for chunk in response:
                    if chunk.choices[0].text:
                        yield f"data: {json.dumps({'content': chunk.choices[0].text})}\n\n"
                        await asyncio.sleep(0.1)  # Rate limit streaming
            else:
                # Use chat completions endpoint for chat models
                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=[
                        {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=self.temperature,
                    frequency_penalty=0.3,  # Added to reduce repetition
                    presence_penalty=0.3,   # Added to encourage novel responses
                    stream=True
                )
                async for chunk in response:
                    if chunk.choices[0].delta.content:
                        yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
                        await asyncio.sleep(0.1)  # Rate limit streaming
            
        except Exception as e:
            logger.error(f"Error generating stream response: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n" 