import datetime
import shutil

import numpy as np
from fastapi import UploadFile
# from pydub import AudioSegment
from scipy.signal import resample_poly


# def save_and_convert_to_wave(audio: UploadFile):
#     # 将上传的文件保存到临时目录
#     temp_date_time_name = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
#     temp_file_name = f"temp_{temp_date_time_name}_{audio.filename}"
#     temp_file_path = f"./output/{temp_file_name}"
#     with open(temp_file_path, "wb") as buffer:
#         shutil.copyfileobj(audio.file, buffer)
#
#     # 2. 使用 pydub 将 WebM 文件转换为 WAV
#     temp_wav_path = convert_to_wave(temp_file_name)
#     #
#     print(f"Converted {audio.filename} to {temp_wav_path}")
#     return temp_wav_path
#
#
# def convert_to_wave(temp_file_name: str):
#     """
#     Convert a given audio file to WAV format using pydub.
#     :param audio_path: Path to the input audio file.
#     :return: Path to the converted WAV file.
#     """
#     temp_wav_path = f"./output/{temp_file_name}.wav"
#     webm_audio = AudioSegment.from_file(f"./output/{temp_file_name}", format="webm")
#     webm_audio.export(temp_wav_path, format="wav")
#
#
#     return temp_wav_path


def resample_audio_float32(audio: np.ndarray, sr_in: int, sr_out: int = 16000) -> np.ndarray:
    """
    使用 scipy.signal.resample_poly 重采样到 16kHz，保持 float32 [-1, 1].
    """
    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)

    # 计算上采样/下采样比率
    gcd = np.gcd(sr_in, sr_out)
    up = sr_out // gcd
    down = sr_in // gcd

    y = resample_poly(audio, up, down).astype(np.float32)
    return y