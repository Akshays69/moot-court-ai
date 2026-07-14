from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import os
from backend.prompts import get_judge_prompt, get_lawyer_prompt, get_problem_prompt, EVALUATOR_PROMPT

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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

def ask_groq(messages):
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        max_tokens=500
    )
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