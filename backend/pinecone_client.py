from pinecone import Pinecone
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY environment variable is not set")

try:
    # Initialize Pinecone client
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    # List existing indexes
    indexes = pc.list_indexes()
    print("Available indexes:", [index.name for index in indexes])
    
    # Get or create index
    index_name = "chatgenius"
    if index_name not in [index.name for index in indexes]:
        # Create a new index
        pc.create_index(
            name=index_name,
            dimension=1536,  # OpenAI embedding dimension
            metric="cosine",
            spec={
                "serverless": {
                    "cloud": "aws",
                    "region": "us-west-2"
                }
            }
        )
        print(f"Created new index: {index_name}")
    
    # Connect to the index
    index = pc.Index(index_name)
    print(f"Successfully connected to index: {index_name}")

except Exception as e:
    print(f"Error initializing Pinecone: {str(e)}")
    raise