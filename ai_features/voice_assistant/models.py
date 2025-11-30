from pydantic import BaseModel
from typing import List, Dict, Any

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    user_context: Dict[str, Any]
    image_count: int

class ChatResponse(BaseModel):
    status: str
    response_text: str
    tickets: List[Dict[str, Any]]
    usage_cost: float
