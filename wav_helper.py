import struct
import numpy as np


class WAVReader:
    def __init__(self, filepath):
        self.filepath = filepath
        self.format_info = {}
        self.pcm_data = None

    def read_wav_header(self, file):
        """读取WAV文件头信息"""
        # RIFF头 (12字节)
        riff_header = file.read(12)
        if len(riff_header) < 12:
            raise ValueError("文件太小，不是有效的WAV文件")

        riff_tag, file_size, wave_tag = struct.unpack('<4sI4s', riff_header)

        if riff_tag != b'RIFF' or wave_tag != b'WAVE':
            raise ValueError("不是有效的WAV文件")

        # 查找fmt chunk
        while True:
            chunk_header = file.read(8)
            if len(chunk_header) < 8:
                raise ValueError("找不到fmt chunk")

            chunk_id, chunk_size = struct.unpack('<4sI', chunk_header)

            if chunk_id == b'fmt ':
                # 读取fmt chunk数据
                fmt_data = file.read(chunk_size)
                if len(fmt_data) < 16:
                    raise ValueError("fmt chunk数据不完整")

                # 解析基本格式信息 (16字节)
                audio_format, num_channels, sample_rate, byte_rate, block_align, bits_per_sample = struct.unpack(
                    '<HHIIHH', fmt_data[:16])

                self.format_info = {
                    'audio_format': audio_format,
                    'num_channels': num_channels,
                    'sample_rate': sample_rate,
                    'byte_rate': byte_rate,
                    'block_align': block_align,
                    'bits_per_sample': bits_per_sample
                }
                break
            else:
                # 跳过其他chunk
                file.seek(chunk_size, 1)

        # 查找data chunk
        while True:
            chunk_header = file.read(8)
            if len(chunk_header) < 8:
                raise ValueError("找不到data chunk")

            chunk_id, chunk_size = struct.unpack('<4sI', chunk_header)

            if chunk_id == b'data':
                return chunk_size  # 返回PCM数据的大小
            else:
                # 跳过其他chunk
                file.seek(chunk_size, 1)

    def read_pcm_data(self):
        """读取WAV文件并提取PCM数据"""
        with open(self.filepath, 'rb') as file:
            # 读取文件头
            pcm_size = self.read_wav_header(file)

            # 读取PCM数据
            pcm_bytes = file.read(pcm_size)

            # 根据位深度解析PCM数据
            bits_per_sample = self.format_info['bits_per_sample']
            num_channels = self.format_info['num_channels']

            if bits_per_sample == 8:
                # 8位无符号整数
                dtype = np.uint8
                pcm_array = np.frombuffer(pcm_bytes, dtype=dtype)
            elif bits_per_sample == 16:
                # 16位有符号整数
                dtype = np.int16
                pcm_array = np.frombuffer(pcm_bytes, dtype=dtype)
            elif bits_per_sample == 24:
                # 24位需要特殊处理
                pcm_array = self._read_24bit_pcm(pcm_bytes)
            elif bits_per_sample == 32:
                # 32位有符号整数
                dtype = np.int32
                pcm_array = np.frombuffer(pcm_bytes, dtype=dtype)
            else:
                raise ValueError(f"不支持的位深度: {bits_per_sample}")

            # 如果是多声道，重新整形数组
            if num_channels > 1:
                pcm_array = pcm_array.reshape(-1, num_channels)

            self.pcm_data = pcm_array
            return pcm_array

    def _read_24bit_pcm(self, pcm_bytes):
        """处理24位PCM数据"""
        # 24位数据需要扩展到32位
        samples = []
        for i in range(0, len(pcm_bytes), 3):
            if i + 2 < len(pcm_bytes):
                # 读取3个字节，扩展为4字节的32位整数
                byte1, byte2, byte3 = pcm_bytes[i], pcm_bytes[i + 1], pcm_bytes[i + 2]
                # 小端序，符号扩展
                if byte3 & 0x80:  # 负数
                    sample = (byte3 << 24) | (byte2 << 16) | (byte1 << 8) | 0xFF
                else:  # 正数
                    sample = (byte3 << 24) | (byte2 << 16) | (byte1 << 8)
                samples.append(sample)
        return np.array(samples, dtype=np.int32)

    def get_format_info(self):
        """获取音频格式信息"""
        return self.format_info.copy()

    def save_pcm_raw(self, output_path):
        """将PCM数据保存为原始二进制文件"""
        if self.pcm_data is None:
            raise ValueError("请先读取PCM数据")

        with open(output_path, 'wb') as f:
            f.write(self.pcm_data.tobytes())

    def get_duration(self):
        """计算音频时长（秒）"""
        if self.pcm_data is None:
            return 0

        sample_count = len(self.pcm_data)
        if self.format_info['num_channels'] > 1:
            sample_count = sample_count // self.format_info['num_channels']

        return sample_count / self.format_info['sample_rate']


# 使用示例
def main():
    # 替换为你的WAV文件路径
    wav_file = "./output/1.wav"  # 请替换为实际的文件路径

    try:
        # 创建WAV读取器
        reader = WAVReader(wav_file)

        # 读取PCM数据
        pcm_data = reader.read_pcm_data()

        # 显示格式信息
        format_info = reader.get_format_info()
        print("WAV文件信息:")
        print(f"  音频格式: {format_info['audio_format']}")
        print(f"  声道数: {format_info['num_channels']}")
        print(f"  采样率: {format_info['sample_rate']} Hz")
        print(f"  位深度: {format_info['bits_per_sample']} bits")
        print(f"  时长: {reader.get_duration():.2f} 秒")
        print(f"  PCM数据形状: {pcm_data.shape}")
        print(f"  数据类型: {pcm_data.dtype}")

        # 显示前10个采样点
        print(f"\n前10个PCM采样点:")
        if format_info['num_channels'] == 1:
            print(pcm_data[:10])
        else:
            print(pcm_data[:10])

        # 保存PCM原始数据
        # reader.save_pcm_raw("output_pcm.raw")
        # print(f"\nPCM数据已保存到 output_pcm.raw")

        return pcm_data

    except FileNotFoundError:
        print(f"错误: 找不到文件 '{wav_file}'")
        print("请确保文件路径正确，或者创建一个测试WAV文件")
    except Exception as e:
        print(f"读取WAV文件时出错: {e}")


# 简化版本的函数
def extract_pcm_simple(wav_file):
    """简化版本：直接提取PCM数据"""
    reader = WAVReader(wav_file)
    pcm_data = reader.read_pcm_data()
    format_info = reader.get_format_info()
    return pcm_data, format_info


if __name__ == "__main__":
    main()