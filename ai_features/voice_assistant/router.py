
import os
import json
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException
from .models import ChatRequest, ChatResponse, Message
from .processor import calculate_cost, get_audio_duration
import openai
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()
API_KEY = os.getenv("OPENAI_API_KEY")
client = openai.OpenAI(api_key=API_KEY)


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="Server missing OpenAI API Key")
    
    
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        buffer.write(await file.read())

    cost = 0.0
    transcript_text = ""

    try:
        with open(temp_filename, "rb") as audio_check:
            duration = get_audio_duration(audio_check)
            cost = calculate_cost("audio", duration)

        with open(temp_filename, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1", file=audio_file
            )
            transcript_text = transcript.text
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    return {"text": transcript_text, "cost": cost}


@router.post("/chat", response_model=ChatResponse)
async def analyze_ticket_state(request: ChatRequest):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="Server missing OpenAI API Key")

    priority_rules = """
    PRIORITY RULES:
    - CRITICAL (Level 1): Safety/Health threat (Gas, Fire, Major Leak).
    - HIGH (Level 2): Function loss (No AC/Heat/Water).
    - MEDIUM (Level 3): Inconvenience (Appliance broken, minor leak).
    - LOW (Level 4): Cosmetic (Paint, Trim).
    """

    system_prompt = f"""
    You are a friendly building manager AI.
    CONTEXT: {json.dumps(request.user_context)}
    GOAL: Identify one OR MORE maintenance issues and prepare tickets.

    PROCESS:
    1. Analyze the user's input to identify distinct problems.
    2. **Sufficiency Check**: For EACH problem, determine if the description is detailed enough. 
    3. **Multiple Issues**: If the user mentions multiple things, create separate objects.
    4. **Completion Check**: ONLY set status to "completed" when the user explicitly confirms they have NO more issues.

    OUTPUT JSON FORMAT:
    {{
        "status": "clarifying" OR "completed",
        "response_text": "Message to user",
        "tickets": [
            {{ "property_name": "...", "unit_number": "...", "title": "...", "description": "...", "category": "...", "priority": "..." }}
        ]
    }}
    
    RULES:
    - Images attached count: {request.image_count}.
    - Priority Rules: {priority_rules}
    """

    messages = [{"role": "system", "content": system_prompt}] + [m.dict() for m in request.messages]

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Calculate Cost
    input_cost = calculate_cost("input_tokens", response.usage.prompt_tokens)
    output_cost = calculate_cost("output_tokens", response.usage.completion_tokens)
    total_cost = input_cost + output_cost

    # Parse Content
    content = json.loads(response.choices[0].message.content)

    return ChatResponse(
        status=content.get("status", "clarifying"),
        response_text=content.get("response_text", ""),
        tickets=content.get("tickets", []),
        usage_cost=total_cost
    )
