from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import os
import json
from supabase import create_client, Client
from backend.prompts import get_judge_prompt, get_lawyer_prompt, get_problem_prompt, EVALUATOR_PROMPT

load_dotenv()

MODEL_FALLBACK_LIST = [
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "qwen/qwen3.6-27b",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "groq/compound",
    "groq/compound-mini"
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY')
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

history = []

class ChatRequest(BaseModel):
    message: str
    mode: str
    domain: str
    side: str

class ProblemRequest(BaseModel):
    domain: str
    side: str

def get_groq_response(messages, stream=False, max_tokens=1024):
    last_error = None
    for model_name in MODEL_FALLBACK_LIST:
        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                stream=stream,
                max_tokens=max_tokens
            )
            print(f"✅ Using model: {model_name}")
            return response, model_name
        except Exception as e:
            error_str = str(e)
            if 'decommissioned' in error_str or \
               'model_decommissioned' in error_str or \
               'does not exist' in error_str or \
               'invalid_request_error' in error_str:
                print(f"⚠️ Model {model_name} failed, trying next fallback...")
                last_error = e
                continue
            else:
                raise e
    raise Exception(
        f"All fallback models failed. Last error: {last_error}"
    )

def ask_groq(messages, max_tokens=500):
    response, model_used = get_groq_response(messages, stream=False, max_tokens=max_tokens)
    return response.choices[0].message.content

@app.post("/chat")
def chat(req: ChatRequest):
    if req.mode == "judge":
        system = get_judge_prompt(req.domain, req.side)
    else:
        system = get_lawyer_prompt(req.domain, req.side)

    history.append({"role": "user", "content": req.message})

    messages = [{"role": "system", "content": system}] + history
    ai_reply = ask_groq(messages)

    history.append({"role": "assistant", "content": ai_reply})
    return {"reply": ai_reply}

@app.post("/api/chat/stream")
@app.post("/chat/stream")
async def chat_stream(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    domain = body.get("domain", "")
    role = body.get("role", "")
    mode = body.get("mode", role)
    side = body.get("side", "")

    if mode == "judge":
        system_prompt = get_judge_prompt(domain, side)
    else:
        system_prompt = get_lawyer_prompt(domain, side)

    full_messages = [
        {"role": "system", "content": system_prompt}
    ] + messages

    def generate():
        try:
            response, model_used = get_groq_response(
                full_messages, stream=True
            )
            for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    data = json.dumps({"text": delta})
                    yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/generate-problem")
def generate_problem(req: ProblemRequest):
    system = get_problem_prompt(req.domain, req.side)
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Generate the moot court problem now."}
    ]
    problem = ask_groq(messages)
    return {"problem": problem}

@app.post("/evaluate")
def evaluate():
    messages = [{"role": "system", "content": EVALUATOR_PROMPT}] + history
    evaluation = ask_groq(messages)
    return {"evaluation": evaluation}

@app.post("/reset")
def reset():
    history.clear()
    return {"status": "cleared"}

@app.get("/admin/users")
async def get_all_users(authorization: str = Header(None)):
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Supabase admin client not initialized")
    users = supabase_admin.table('profiles').select('*').execute()
    return users.data