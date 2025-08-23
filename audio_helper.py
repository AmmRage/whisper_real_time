import datetime
import os
import shutil
from pydub import AudioSegment
from fastapi import FastAPI, UploadFile, Depends, HTTPException, File

def save_and_convert_to_wave(audio: UploadFile):
    # 将上传的文件保存到临时目录
    temp_date_time_name = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_file_name = f"temp_{temp_date_time_name}_{audio.filename}"
    temp_file_path = f"./output/{temp_file_name}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    # 2. 使用 pydub 将 WebM 文件转换为 WAV
    temp_wav_path = convert_to_wave(temp_file_name)
    #
    print(f"Converted {audio.filename} to {temp_wav_path}")
    return temp_wav_path


def convert_to_wave(temp_file_name: str):
    """
    Convert a given audio file to WAV format using pydub.
    :param audio_path: Path to the input audio file.
    :return: Path to the converted WAV file.
    """
    temp_wav_path = f"./output/{temp_file_name}.wav"
    webm_audio = AudioSegment.from_file(f"./output/{temp_file_name}", format="webm")
    webm_audio.export(temp_wav_path, format="wav")


    return temp_wav_path