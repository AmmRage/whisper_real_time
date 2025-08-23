import struct
import os


class FileFormatDetector:
    def __init__(self, filepath):
        self.filepath = filepath
        self.file_size = os.path.getsize(filepath)

    def detect_format(self):
        """检测文件的真实格式"""
        with open(self.filepath, 'rb') as f:
            # 读取文件开头的字节用于格式识别
            header = f.read(64)  # 读取前64字节应该足够识别大多数格式

            results = {
                'detected_formats': [],
                'file_size': self.file_size,
                'hex_header': header[:32].hex(),  # 显示前32字节的十六进制
                'ascii_header': self._bytes_to_ascii(header[:32])
            }

            # 检测各种音频格式
            self._check_wav(header, results)
            self._check_webm(header, results)
            self._check_ogg(header, results)
            self._check_mp3(header, results)
            self._check_flac(header, results)
            self._check_m4a_aac(header, results)
            self._check_opus(header, results)

            return results

    def _bytes_to_ascii(self, data):
        """将字节转换为可读的ASCII字符串"""
        result = ""
        for byte in data:
            if 32 <= byte <= 126:  # 可打印ASCII字符
                result += chr(byte)
            else:
                result += f"\\x{byte:02x}"
        return result

    def _check_wav(self, header, results):
        """检查是否为WAV格式"""
        if len(header) >= 12:
            if header[0:4] == b'RIFF' and header[8:12] == b'WAVE':
                # 进一步验证WAV结构
                with open(self.filepath, 'rb') as f:
                    try:
                        # 跳过RIFF头
                        f.seek(12)
                        chunk_found = False

                        # 查找fmt chunk
                        for _ in range(10):  # 最多检查10个chunk
                            chunk_header = f.read(8)
                            if len(chunk_header) < 8:
                                break

                            chunk_id, chunk_size = struct.unpack('<4sI', chunk_header)

                            if chunk_id == b'fmt ':
                                chunk_found = True
                                break
                            else:
                                f.seek(chunk_size, 1)  # 跳过chunk数据

                        confidence = "高" if chunk_found else "中"
                        results['detected_formats'].append({
                            'format': 'WAV',
                            'confidence': confidence,
                            'signature': 'RIFF...WAVE',
                            'details': f'RIFF容器，WAVE格式，fmt chunk{"已找到" if chunk_found else "未找到"}'
                        })
                    except:
                        results['detected_formats'].append({
                            'format': 'WAV',
                            'confidence': '低',
                            'signature': 'RIFF...WAVE',
                            'details': 'RIFF/WAVE头部正确，但结构验证失败'
                        })

    def _check_webm(self, header, results):
        """检查是否为WebM格式"""
        # WebM是基于Matroska的，开头是EBML
        if len(header) >= 4 and header[0:4] == b'\x1a\x45\xdf\xa3':
            # 进一步检查是否包含webm标识
            with open(self.filepath, 'rb') as f:
                # 读取更多数据来查找webm标识
                data = f.read(1024)
                if b'webm' in data.lower():
                    results['detected_formats'].append({
                        'format': 'WebM',
                        'confidence': '高',
                        'signature': '1A 45 DF A3 (EBML)',
                        'details': 'EBML头部 + webm标识符'
                    })
                else:
                    results['detected_formats'].append({
                        'format': 'Matroska/WebM',
                        'confidence': '中',
                        'signature': '1A 45 DF A3 (EBML)',
                        'details': 'EBML头部，可能是Matroska或WebM'
                    })

    def _check_ogg(self, header, results):
        """检查是否为OGG格式"""
        if len(header) >= 4 and header[0:4] == b'OggS':
            results['detected_formats'].append({
                'format': 'OGG',
                'confidence': '高',
                'signature': 'OggS',
                'details': 'OGG容器格式'
            })

    def _check_mp3(self, header, results):
        """检查是否为MP3格式"""
        if len(header) >= 3:
            # 检查ID3标签
            if header[0:3] == b'ID3':
                results['detected_formats'].append({
                    'format': 'MP3',
                    'confidence': '高',
                    'signature': 'ID3',
                    'details': 'MP3文件，包含ID3标签'
                })
            # 检查MPEG音频帧头
            elif len(header) >= 2:
                if (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
                    results['detected_formats'].append({
                        'format': 'MP3',
                        'confidence': '中',
                        'signature': 'FF Ex (MPEG Frame)',
                        'details': 'MPEG音频帧头'
                    })

    def _check_flac(self, header, results):
        """检查是否为FLAC格式"""
        if len(header) >= 4 and header[0:4] == b'fLaC':
            results['detected_formats'].append({
                'format': 'FLAC',
                'confidence': '高',
                'signature': 'fLaC',
                'details': 'FLAC无损音频格式'
            })

    def _check_m4a_aac(self, header, results):
        """检查是否为M4A/AAC格式"""
        if len(header) >= 8:
            # 检查ftyp原子
            if header[4:8] == b'ftyp':
                # 进一步检查是否为音频格式
                if len(header) >= 12:
                    brand = header[8:12]
                    if brand in [b'M4A ', b'mp41', b'mp42', b'isom']:
                        results['detected_formats'].append({
                            'format': 'M4A/AAC',
                            'confidence': '高',
                            'signature': f'ftyp{brand.decode("ascii", errors="ignore")}',
                            'details': f'MP4容器，品牌: {brand}'
                        })

    def _check_opus(self, header, results):
        """检查是否为Opus格式（在OGG容器中）"""
        if len(header) >= 8 and header[0:4] == b'OggS':
            with open(self.filepath, 'rb') as f:
                data = f.read(512)
                if b'OpusHead' in data:
                    results['detected_formats'].append({
                        'format': 'Opus',
                        'confidence': '高',
                        'signature': 'OggS + OpusHead',
                        'details': 'Opus音频编码在OGG容器中'
                    })

    def analyze_file_structure(self):
        """分析文件结构的详细信息"""
        analysis = {
            'file_size': self.file_size,
            'structure_analysis': []
        }

        with open(self.filepath, 'rb') as f:
            header = f.read(64)

            # WAV结构分析
            if header[0:4] == b'RIFF' and len(header) >= 12:
                if header[8:12] == b'WAVE':
                    analysis['structure_analysis'].append(self._analyze_wav_structure())

            # WebM/Matroska结构分析
            elif header[0:4] == b'\x1a\x45\xdf\xa3':
                analysis['structure_analysis'].append(self._analyze_webm_structure())

        return analysis

    def _analyze_wav_structure(self):
        """详细分析WAV文件结构"""
        wav_info = {
            'format': 'WAV',
            'chunks': [],
            'valid_structure': True
        }

        try:
            with open(self.filepath, 'rb') as f:
                # RIFF头
                riff_header = f.read(12)
                riff_tag, file_size, wave_tag = struct.unpack('<4sI4s', riff_header)

                wav_info['chunks'].append({
                    'type': 'RIFF Header',
                    'size': 12,
                    'data': f'Tag: {riff_tag}, Size: {file_size}, Format: {wave_tag}'
                })

                # 解析chunks
                while f.tell() < self.file_size:
                    chunk_pos = f.tell()
                    chunk_header = f.read(8)
                    if len(chunk_header) < 8:
                        break

                    chunk_id, chunk_size = struct.unpack('<4sI', chunk_header)

                    wav_info['chunks'].append({
                        'type': f'Chunk: {chunk_id.decode("ascii", errors="ignore")}',
                        'position': chunk_pos,
                        'size': chunk_size + 8,
                        'data_size': chunk_size
                    })

                    # 跳到下一个chunk
                    f.seek(chunk_size, 1)

        except Exception as e:
            wav_info['valid_structure'] = False
            wav_info['error'] = str(e)

        return wav_info

    def _analyze_webm_structure(self):
        """简单分析WebM/Matroska结构"""
        webm_info = {
            'format': 'WebM/Matroska',
            'elements': [],
            'has_webm_signature': False
        }

        try:
            with open(self.filepath, 'rb') as f:
                data = f.read(min(2048, self.file_size))

                if b'webm' in data.lower():
                    webm_info['has_webm_signature'] = True

                # 查找一些常见的EBML元素
                elements = [b'EBML', b'Segment', b'Info', b'Tracks', b'Cluster']
                for element in elements:
                    if element in data:
                        pos = data.find(element)
                        webm_info['elements'].append({
                            'element': element.decode('ascii'),
                            'position': pos
                        })

        except Exception as e:
            webm_info['error'] = str(e)

        return webm_info


# 使用示例和主函数
def analyze_mysterious_file(filepath):
    """分析神秘的102k文件"""
    if not os.path.exists(filepath):
        print(f"错误: 文件 '{filepath}' 不存在")
        return

    print(f"正在分析文件: {filepath}")
    print(f"文件大小: {os.path.getsize(filepath)} 字节\n")

    detector = FileFormatDetector(filepath)

    # 格式检测
    results = detector.detect_format()

    print("=== 文件头部信息 ===")
    print(f"十六进制: {results['hex_header']}")
    print(f"ASCII表示: {results['ascii_header']}\n")

    print("=== 检测到的格式 ===")
    if results['detected_formats']:
        for i, fmt in enumerate(results['detected_formats'], 1):
            print(f"{i}. {fmt['format']}")
            print(f"   置信度: {fmt['confidence']}")
            print(f"   特征码: {fmt['signature']}")
            print(f"   详细信息: {fmt['details']}\n")
    else:
        print("未检测到已知的音频格式\n")

    # 结构分析
    print("=== 文件结构分析 ===")
    structure = detector.analyze_file_structure()
    for analysis in structure['structure_analysis']:
        print(f"格式: {analysis['format']}")

        if analysis['format'] == 'WAV':
            print(f"结构有效: {analysis.get('valid_structure', False)}")
            if 'chunks' in analysis:
                print("Chunks:")
                for chunk in analysis['chunks']:
                    print(f"  - {chunk['type']}: {chunk.get('data')}, f'Size: {chunk.get('size', 0)}'')")

            elif analysis['format'] == 'WebM/Matroska':
                print(f"包含WebM标识: {analysis.get('has_webm_signature', False)}")
            if 'elements' in analysis and analysis['elements']:
                print("EBML元素:")
            for elem in analysis['elements']:
                print(f"  - {elem['element']} at position {elem['position']}")

            print()


def main():
    """主函数 - 请替换为你的文件路径"""
    # 替换为你的实际文件路径
    mysterious_file = "1.webm"  # 或者 "mysterious_file.wav"

    print("文件格式检测器")
    print("=" * 50)

    analyze_mysterious_file(mysterious_file)

    print("\n=== 建议 ===")
    print("1. 如果检测到WAV格式，说明这是一个真正的WAV音频文件")
    print("2. 如果检测到WebM格式，说明这是一个WebM容器文件")
    print("3. 如果两种格式都检测到，可能存在格式伪装或文件损坏")
    print("4. 某些播放器会根据文件内容而非扩展名来判断格式")


if __name__ == "__main__":
    main()