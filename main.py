from typing import Union

from fastapi import FastAPI, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],         # 允许所有方法
    allow_headers=["*"],         # 允许所有请求头
)

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


@app.on_event("startup")
def startup_event():
    global model
    # init modal
    pass

def get_model():
    return model

@app.post("/asr")
def asr(file: UploadFile, m=Depends(get_model)):
    # audio blob in webm
    # convert to wav and transcribe by whisper
    # return text

    # audio_path = "/tmp/audio.wav"
    # with open(audio_path, "wb") as f:
    #     f.write(file.file.read())
    #
    # segments, _ = m.transcribe(audio_path)
    # text = "".join([seg.text for seg in segments])
    # return {"text": text}

    pass