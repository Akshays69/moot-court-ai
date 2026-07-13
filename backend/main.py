from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from backend.prompts import get_judge_prompt, get_lawyer_prompt, get_problem_prompt, EVALUATOR_PROMPT

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

history = []

class ChatRequest(BaseModel):
    message: str
    mode: str
    domain: str
    side: str

class ProblemRequest(BaseModel):
    domain: str
    side: str

@app.post("/chat")
def chat(req: ChatRequest):
    if req.mode == "judge":
        system = get_judge_prompt(req.domain, req.side)
    else:
        system = get_lawyer_prompt(req.domain, req.side)

    history.append({"role": "user", "content": req.message})

    response = requests.post("http://localhost:11434/api/chat", json={
        "model": "phi3",
        "messages": [{"role": "system", "content": system}] + history,
        "stream": False
    })

    result = response.json()
    ai_reply = result.get("message", {}).get("content") or result.get("response", "No response received")
    history.append({"role": "assistant", "content": ai_reply})
    return {"reply": ai_reply}

@app.post("/generate-problem")
def generate_problem(req: ProblemRequest):
    system = get_problem_prompt(req.domain, req.side)
    response = requests.post("http://localhost:11434/api/chat", json={
        "model": "phi3",
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": "Generate the moot court problem now."}],
        "stream": False
    })
    result = response.json()
    problem = result.get("message", {}).get("content") or result.get("response", "Could not generate problem")
    return {"problem": problem}

@app.post("/evaluate")
def evaluate():
    response = requests.post("http://localhost:11434/api/chat", json={
        "model": "phi3",
        "messages": [{"role": "system", "content": EVALUATOR_PROMPT}] + history,
        "stream": False
    })
    result = response.json()
    evaluation = result.get("message", {}).get("content") or result.get("response", "No response received")
    return {"evaluation": evaluation}

@app.post("/reset")
def reset():
    history.clear()
    return {"status": "cleared"}