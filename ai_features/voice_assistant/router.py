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
    - URGENT (Level 1): Safety/Health threat (Gas, Fire, Major Leak, Flooding).
    - HIGH (Level 2): Function loss (No AC/Heat/Water/Electricity).
    - MEDIUM (Level 3): Inconvenience (Appliance broken, minor leak, noisy neighbors).
    - LOW (Level 4): Cosmetic (Paint, Trim, non-urgent request).
    """

    system_prompt = f"""
    You are a friendly but efficient building manager AI.
    
    CONTEXT DATA: {json.dumps(request.user_context)}
    
    GOAL: Create maintenance tickets based on user input.

    IMPORTANT RULES:
    1. **Property & Unit Known**: The user has already selected the property and unit in the app (provided in CONTEXT DATA). **NEVER** ask the user for property name or unit number. Fill these fields in the ticket automatically using the context.
    2. **Low Clarification Threshold**: Do not be overly inquisitive. 
       - If the user says "the sink leaks", **ACCEPT IT**. Do not ask "which sink?" or "how bad?". Create a ticket with the info you have.
       - Only ask for clarification if the input is completely ambiguous (e.g., "it is broken" with no object mentioned).
       - If severity is unclear, default to MEDIUM or LOW based on the object, do not ask.
    3. **Multiple Issues**: If the user mentions multiple items, create separate ticket objects in the list.
    4. **Completion**: If you have created a ticket, set status to "completed" immediately unless the user explicitly asks to add more.

    OUTPUT JSON FORMAT:
    {{
        "status": "clarifying" OR "completed",
        "response_text": "Brief confirmation message to user (e.g. 'Ticket created for the sink.')",
        "tickets": [
            {{ "property_name": "...", "unit_number": "...", "title": "...", "description": "...", "category": "...", "priority": "..." }}
        ]
    }}
    
    DATA RULES:
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
        status=content.get("status", "completed"),
        response_text=content.get("response_text", ""),
        tickets=content.get("tickets", []),
        usage_cost=total_cost
    )
