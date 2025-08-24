import React, {useState, useRef, useEffect} from 'react';
import {Button, Card, Typography, Alert, Progress, message} from 'antd';

const {Title, Text} = Typography;

const DeepSeekAudioWorkletRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [audioData, setAudioData] = useState([]);
    const [volume, setVolume] = useState(0);
    const [error, setError] = useState(null);
    const [sampleRate, setSampleRate] = useState(0);

    const [recordedTime, setRecordedTime] = useState("");

    const audioContextRef = useRef(null);
    const workletNodeRef = useRef(null);
    const recordingStartTimeRef = useRef(0);
    const recordingDurationRef = useRef(0);
    const animationFrameRef = useRef(null);
    const batchBufferRef = useRef([]);
    const audioDataRef = useRef([]); // 使用ref来避免闭包问题

    // AudioWorklet处理器代码
    const workletProcessorCode = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.batchBuffer = [];
        this.batchSize = 8;
        this.batchCount = 0;
        this.lastVolumeUpdate = 0;
        this.volumeUpdateInterval = 10;
      }

      process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input.length > 0) {
          const channelData = input[0];
          
          // 批量收集数据
          for (let i = 0; i < channelData.length; i++) {
            this.batchBuffer.push(channelData[i]);
          }
          
          this.batchCount++;
          
          // 批量发送数据
          if (this.batchCount >= this.batchSize) {
            if (this.batchBuffer.length > 0) {
              this.port.postMessage({
                type: 'audioBatch',
                data: this.batchBuffer,
                sampleRate: sampleRate // 修复：使用全局sampleRate
              });
              this.batchBuffer = [];
            }
            this.batchCount = 0;
          }
          
          // 节流音量更新
          this.lastVolumeUpdate++;
          if (this.lastVolumeUpdate >= this.volumeUpdateInterval) {
            let sum = 0;
            for (let i = 0; i < channelData.length; i++) {
              sum += Math.abs(channelData[i]);
            }
            const avg = sum / channelData.length;
            this.port.postMessage({
              type: 'volume',
              volume: avg * 100
            });
            this.lastVolumeUpdate = 0;
          }
        }
        return true;
      }
    }

    registerProcessor('pcm-processor', PCMProcessor);
  `;

    // 创建WAV文件头
    const createWavHeader = (dataLength, sampleRate, numChannels = 1, bitsPerSample = 32) => {
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = dataLength * (bitsPerSample / 8);
        const fileSize = 36 + dataSize;

        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);

        // RIFF identifier
        writeString(view, 0, 'RIFF');
        // RIFF chunk length
        view.setUint32(4, fileSize, true);
        // RIFF type
        writeString(view, 8, 'WAVE');
        // Format chunk identifier
        writeString(view, 12, 'fmt ');
        // Format chunk length
        view.setUint32(16, 16, true);
        // Sample format (raw PCM)
        view.setUint16(20, 3, true); // 3 = IEEE float
        // Number of channels
        view.setUint16(22, numChannels, true);
        // Sample rate
        view.setUint32(24, sampleRate, true);
        // Byte rate (sample rate * block align)
        view.setUint32(28, byteRate, true);
        // Block align (channel count * bytes per sample)
        view.setUint16(32, blockAlign, true);
        // Bits per sample
        view.setUint16(34, bitsPerSample, true);
        // Data chunk identifier
        writeString(view, 36, 'data');
        // Data chunk length
        view.setUint32(40, dataSize, true);

        return buffer;
    };

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // 将Float32Array转换为WAV文件
    const convertToWav = (audioData, sampleRate) => {
        const header = createWavHeader(audioData.length, sampleRate);
        const data = new Float32Array(audioData);

        const wavBuffer = new ArrayBuffer(header.byteLength + data.byteLength);

        // 写入文件头
        new Uint8Array(wavBuffer, 0, header.byteLength).set(new Uint8Array(header));

        // 写入音频数据
        const dataView = new DataView(wavBuffer, header.byteLength);
        for (let i = 0; i < data.length; i++) {
            dataView.setFloat32(i * 4, data[i], true);
        }

        return wavBuffer;
    };

    // 将Float32Array转换为WAV文件
    const getPurePcm = (audioData) => {
        const data = new Float32Array(audioData);
        const wavBuffer = new ArrayBuffer(data.byteLength);

        // 写入音频数据
        const dataView = new DataView(wavBuffer, 0);
        for (let i = 0; i < data.length; i++) {
            dataView.setFloat32(i * 4, data[i], true);
        }

        return wavBuffer;
    };

    // 发送WAV文件到后端
    const sendAudioDataToBackend = async (wavBuffer, sampleRate, filename = 'recording.wav') => {
        try {
            const blob = new Blob([wavBuffer], {type: 'audio/wav'});
            const formData = new FormData();
            formData.append('audio', blob, filename);
            //
            // formData.append('sampleRate', sampleRate.toString());
            // formData.append('timestamp', Date.now().toString());
            // formData.append('format', 'pcm');

            // 这里替换为您的后端API地址
            const response = await fetch('http://127.0.0.1:8000/asr3', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                message.success('音频文件已成功发送到后端');
                const responseJson = await response.json();
                console.log('音频文件发送成功:', responseJson);
                return responseJson;
            } else {
                throw new Error('上传失败');
            }
        } catch (error) {
            console.error('发送音频文件失败:', error);
            message.error('发送音频文件失败');
            throw error;
        }
    };

    // 下载WAV文件（用于测试）
    const downloadWav = (wavBuffer, filename = 'recording.wav') => {
        const blob = new Blob([wavBuffer], {type: 'audio/wav'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 保存并发送录音
    const saveAndSendRecording = async () => {
        if (audioDataRef.current.length === 0) {
            message.warning('没有录音数据可保存');
            return;
        }

        try {
            message.loading('正在生成WAV文件...', 0);
            console.log('总样本数:', audioDataRef.current.length);
            console.log('采样率:', sampleRate);
            // 生成WAV文件
            const wavBuffer = convertToWav(audioDataRef.current, sampleRate);

            // 发送到后端
            await sendAudioDataToBackend(wavBuffer, sampleRate, `recording_${Date.now()}.wav`);

            // 也可以本地下载（测试用）
            // downloadWav(wavBuffer, `recording_${Date.now()}.wav`);

            message.destroy();
            message.success('WAV文件已生成并发送');

        } catch (error) {
            message.destroy();
            console.error('保存录音失败:', error);
        }
    };

    // 初始化AudioWorklet
    const initializeAudioWorklet = async () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
            setSampleRate(audioContextRef.current.sampleRate);

            const blob = new Blob([workletProcessorCode], {type: 'application/javascript'});
            const url = URL.createObjectURL(blob);
            await audioContextRef.current.audioWorklet.addModule(url);

            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            const source = audioContextRef.current.createMediaStreamSource(stream);

            workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'pcm-processor');

            workletNodeRef.current.port.onmessage = async (event) => {
                const data = event.data;
                if (data.type === 'audioBatch') {
                    console.log('Received audio batch:', data.data.length);
                    // console.log("类型：", typeof data.data);
                    console.log("采样率：", data.sampleRate);

                    //
                    const recordedSeconds = data.data.length / data.sampleRate;
                    const minutes = Math.floor(recordedSeconds / 60);
                    const remainingSeconds = (recordedSeconds % 60).toFixed(2);

                    setRecordedTime(`${minutes}:${remainingSeconds.padStart(5, '0')}`);
                    //
                    // // 生成WAV文件 // 发送到后端
                    // const wavBuffer = convertToWav(data.data, data.sampleRate);
                    // await sendAudioDataToBackend(wavBuffer, data.sampleRate, `recording_${Date.now()}.wav`);

                    // 纯 pcm 数据
                    // const pcmBuffer = getPurePcm(data.data);
                    // await sendAudioDataToBackend(pcmBuffer, data.sampleRate, `recording_${Date.now()}.pcm`);


                    // 更新ref和state
                    audioDataRef.current = [...audioDataRef.current, ...data.data];
                    setAudioData(prev => [...prev, ...data.data]);
                } else if (data.type === 'volume') {
                    setVolume(data.volume);
                }
            };

            source.connect(workletNodeRef.current);
            workletNodeRef.current.connect(audioContextRef.current.destination);
            // startVisualization();

            return true;
        } catch (err) {
            console.error('Error initializing audio worklet:', err);
            setError(`初始化音频处理失败: ${err.message}`);
            return false;
        }
    };

    // 开始录音
    const startRecording = async () => {
        setError(null);
        setAudioData([]);
        audioDataRef.current = [];
        recordingDurationRef.current = 0;
        recordingStartTimeRef.current = Date.now();

        const success = await initializeAudioWorklet();
        if (success) {
            setIsRecording(true);
            setIsPaused(false);
        }
    };


    // 停止录音
    const stopRecording = () => {
        if (workletNodeRef.current) {
            workletNodeRef.current.port.postMessage('stop');
        }

        if (audioContextRef.current) {
            if (audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        }

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }

        setIsRecording(false);
        setIsPaused(false);
    };

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return (
        <div style={{maxWidth: 800, margin: '0 auto', padding: 24}}>
            <Title level={2}>AudioWorklet WAV录音器</Title>

            <Card style={{marginBottom: 24}}>
                {/* ... UI代码保持不变 ... */}

                <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
                    <Button
                        type="primary"
                        onClick={startRecording}
                        disabled={isRecording}
                    >
                        开始录音
                    </Button>

                    <Button
                        danger
                        onClick={stopRecording}
                        disabled={!isRecording}
                    >
                        停止
                    </Button>

                    <Button
                        type="default"
                        onClick={saveAndSendRecording}
                        disabled={isRecording || audioData.length === 0}
                    >
                        保存并发送
                    </Button>
                </div>

                {error && (
                    <Alert message="错误" description={error} type="error" showIcon/>
                )}
            </Card>

            <Card title="录音数据">
                <Text>已收集 {audioData.length} 个样本</Text>
                <br />
                <Text>采样率: {sampleRate} Hz</Text>
                <br />
                <Text strong>录制时长: {recordedTime}</Text>

                {audioData.length > 0 && (
                    <div style={{marginTop: 16}}>
                        <Text strong>前10个样本: </Text>
                        <div style={{
                            background: '#f0f0f0',
                            padding: 12,
                            borderRadius: 6,
                            marginTop: 8,
                            maxHeight: 120,
                            overflow: 'auto'
                        }}>
                            {audioData.slice(0, 10).map((value, index) => (
                                <span key={index} style={{marginRight: 8}}>
                  {value.toFixed(6)}
                </span>
                            ))}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default DeepSeekAudioWorkletRecorder;
