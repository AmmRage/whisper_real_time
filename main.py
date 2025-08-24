import datetime
import os
import shutil
from contextlib import asynccontextmanager
from typing import Union
import numpy as np
import whisper
# from faster_whisper import WhisperModel
from fastapi import FastAPI, UploadFile, Depends, HTTPException, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydub import AudioSegment
import torch
from audio_helper import save_and_convert_to_wave, resample_audio_float32
import ssl

ssl._create_default_https_context = ssl._create_unverified_context
# 定义全局变量，用于存储加载的 Whisper 模型
whisper_model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 生命周期事件。
    在应用启动时加载 Whisper 模型。
    """
    global whisper_model
    print("加载 Whisper 模型...")
    # 你可以根据需要选择不同的模型，如 "base", "small", "medium" 等
    whisper_model = whisper.load_model("medium.en")
    print("模型加载完成。")
    yield
    # 在应用关闭时可以进行一些清理工作，这里不做特殊处理
    print("应用关闭。")
app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],         # 允许所有方法
    allow_headers=["*"],         # 允许所有请求头
)

#

enable_fp16 = torch.cuda.is_available()  # 如果有GPU就用fp16


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}


# @app.on_event("startup")
# def startup_event():
#     global model
#     model = WhisperModel("base", device="cuda", compute_type="float16")
#
# def get_model():
#     return model


# @app.post("/asr")
# async def asr(audio: UploadFile, m=Depends(get_model)):
#     try:
#         print(f"Received audio file: {audio.filename}")
#         print(f"Content type: {audio.content_type}")
#         print(f"File size: {audio.size}")
#
#         # 这里可以处理音频文件
#         content = await audio.read()
#         print(f"Audio content length: {len(content)} bytes")
#
#         return {"status": "ok", "filename": audio.filename}
#     except Exception as e:
#         print(f"Error processing audio: {e}")
#         raise HTTPException(status_code=500, detail=str(e))
#     print("Received audio file:", audio.filename)
#
#     # audio blob in webm
#     # convert to wav and transcribe by whisper
#     # return text
#
#     # audio_path = "/tmp/audio.wav"
#     # with open(audio_path, "wb") as f:
#     #     f.write(file.file.read())
#     #
#     # segments, _ = m.transcribe(audio_path)
#     # text = "".join([seg.text for seg in segments])
#     # return {"text": text}
#
#     # contents = await audio.read()
#     # print(audio.filename)   # recording.webm
#     # print(audio.content_type)  # audio/webm
#     # 处理完返回
#     return {"status": "ok"}


@app.post("/asr2")
async def asr_endpoint(audio: UploadFile = File(...)):
    """
    接收 WebM 音频文件并使用 Whisper 进行语音转文字。
    """
    try:
        print(f"Received audio file type: {audio.content_type}")
        # 确保上传的文件是 WebM 格式
        if str.find(audio.content_type, "audio/webm") == -1:
            print(f"Unsupported file type: {audio.content_type}")
            return {"error": "Unsupported file type. Please upload an audio/webm file."}

        print(f"Received audio file name: {audio.filename}")
        # 将上传的文件保存到临时目录
        temp_wav_path = save_and_convert_to_wave(audio)

        # 使用 Whisper 转录音频文件
        result = whisper_model.transcribe(temp_wav_path) # fp16=False 适用于没有GPU的情况

        # 删除临时文件
        # os.remove(temp_file_path)

        # 返回转录结果
        return {"transcription": result["text"]}

    except Exception as e:
        # 如果发生任何错误，返回错误信息
        return {"error": f"An error occurred: {e}"}


@app.post("/asr3")
async def asr_endpoint(audio: UploadFile = File(...)):
    """
    接收带有header的 wav 音频文件并使用 Whisper 进行语音转文字。
    """
    print(f"Received audio file type: {audio.content_type}")
    temp_date_time_name = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_file_name = f"temp_{temp_date_time_name}_{audio.filename}"
    temp_file_path = f"./output/{temp_file_name}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    # 使用 Whisper 转录音频文件， 返回转录结果
    result = whisper_model.transcribe(temp_file_path, fp16=enable_fp16) # fp16=False 适用于没有GPU的情况
    return {"transcription": result["text"]}

    # 返回转录结果
    return {"success": True}

@app.post("/asr4")
async def asr_endpoint(audio: UploadFile = File(...),
    sampleRate: str = Form(None),
    timestamp: str = Form(None),
    format: str = Form(None)):
    """
    接收纯AudioWorklet的纯 pcm数据，
    在AudioWorklet里是float32，归一化的，所以i可以给whisper直接用
    """
    try:
        audio_content = await audio.read()
        print(f"Received audio file length: {len(audio_content)} bytes")
        print(f"Sample rate: {sampleRate}")
        print(f"Timestamp: {timestamp}")
        print(f"Format: {format}")

        # 直接把音频内容转成numpy数组
        audio_np = np.frombuffer(audio_content, dtype=np.float32)
        print(f"Audio numpy array shape: {audio_np.shape}, dtype: {audio_np.dtype}")
        resampled_data_np = resample_audio_float32(audio_np, sr_in=int(sampleRate), sr_out=16000)

        print(f"Resampled audio length: {len(resampled_data_np)} samples")

        # 使用 Whisper 转录音频文件， 返回转录结果
        result = whisper_model.transcribe(resampled_data_np, fp16=enable_fp16) # fp16=False 适用于没有GPU的情况
        return {"transcription": result["text"]}

        return {"success": True}
    except Exception as e:
        # 如果发生任何错误，返回错误信息
        return {"error": f"An error occurred: {e}"}


@app.get("/test")
def try_wav_file():
    try:
        # 使用 Whisper 转录音频文件
        result = whisper_model.transcribe("1.wav") # fp16=False 适用于没有GPU的情况
        # 返回转录结果
        return {"transcription": result["text"]}

    except Exception as e:
        # 如果发生任何错误，返回错误信息
        return {"error": f"An error occurred: {e}"}


# 方式2：在 Python 文件中添加
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)