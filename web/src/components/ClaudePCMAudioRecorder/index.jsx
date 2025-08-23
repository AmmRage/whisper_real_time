import React, { useState, useRef, useCallback } from 'react';
import { Button, Space, Typography, Alert } from 'antd';

const { Text } = Typography;

// AudioWorklet处理器代码
const workletCode = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions?.bufferSize || 4096;
    this.sampleRate = options.processorOptions?.sampleRate || 44100;
    this.sharedBuffer = null;
    this.writeIndex = 0;
    this.isRecording = false;
    
    this.port.onmessage = (event) => {
      const { type, sharedBuffer } = event.data;
      
      if (type === 'init-buffer') {
        this.sharedBuffer = new Float32Array(sharedBuffer);
        this.writeIndex = 0;
      } else if (type === 'start') {
        this.isRecording = true;
        this.writeIndex = 0;
      } else if (type === 'stop') {
        this.isRecording = false;
        this.port.postMessage({ 
          type: 'recording-stopped', 
          samplesRecorded: this.writeIndex 
        });
      }
    };
  }
  
  process(inputs, outputs, parameters) {
    if (!this.isRecording || !this.sharedBuffer || inputs.length === 0) {
      return true;
    }
    
    const input = inputs[0];
    if (input.length === 0) return true;
    
    // 获取第一个声道的数据
    const channelData = input[0];
    
    // 将音频数据写入共享缓冲区
    for (let i = 0; i < channelData.length; i++) {
      if (this.writeIndex < this.sharedBuffer.length) {
        this.sharedBuffer[this.writeIndex] = channelData[i];
        this.writeIndex++;
      } else {
        // 缓冲区满了，通知主线程
        this.port.postMessage({ 
          type: 'buffer-full', 
          samplesRecorded: this.writeIndex 
        });
        this.isRecording = false;
        break;
      }
    }
    
    return true;
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
`;

const ClaudePCMAudioRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [error, setError] = useState(null);
    const [recordedSamples, setRecordedSamples] = useState(0);

    const audioContextRef = useRef(null);
    const workletNodeRef = useRef(null);
    const streamRef = useRef(null);
    const sharedBufferRef = useRef(null);
    const recordedDataRef = useRef(null);

    // 检查浏览器支持
    React.useEffect(() => {
        const checkSupport = () => {
            const supported =
                typeof AudioContext !== 'undefined' &&
                typeof AudioWorkletNode !== 'undefined' &&
                typeof SharedArrayBuffer !== 'undefined';

            setIsSupported(supported);

            if (!supported) {
                setError('您的浏览器不支持AudioWorklet或SharedArrayBuffer');
            }
        };

        checkSupport();
    }, []);

    // 初始化音频上下文和工作器
    const initializeAudio = useCallback(async () => {
        try {
            // 创建音频上下文
            audioContextRef.current = new AudioContext();

            // 创建AudioWorklet模块
            const blob = new Blob([workletCode], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);
            await audioContextRef.current.audioWorklet.addModule(workletUrl);
            URL.revokeObjectURL(workletUrl);

            // 获取媒体流
            streamRef.current = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            // 创建音频源
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);

            // 创建共享缓冲区 (10秒的音频数据)
            const bufferSize = 44100 * 10; // 10秒 @ 44.1kHz
            sharedBufferRef.current = new SharedArrayBuffer(bufferSize * 4); // Float32 = 4 bytes
            recordedDataRef.current = new Float32Array(sharedBufferRef.current);

            // 创建AudioWorklet节点
            workletNodeRef.current = new AudioWorkletNode(
                audioContextRef.current,
                'pcm-recorder-processor',
                {
                    processorOptions: {
                        bufferSize: 4096,
                        sampleRate: 44100
                    }
                }
            );

            // 监听工作器消息
            workletNodeRef.current.port.onmessage = (event) => {
                const { type, samplesRecorded } = event.data;

                if (type === 'recording-stopped' || type === 'buffer-full') {
                    setRecordedSamples(samplesRecorded);
                    if (type === 'buffer-full') {
                        setError('录音缓冲区已满，录音自动停止');
                    }
                    stopRecording();
                }
            };

            // 初始化共享缓冲区
            workletNodeRef.current.port.postMessage({
                type: 'init-buffer',
                sharedBuffer: sharedBufferRef.current
            });

            // 连接音频节点
            source.connect(workletNodeRef.current);
            workletNodeRef.current.connect(audioContextRef.current.destination);

        } catch (err) {
            setError('初始化音频失败: ' + err.message);
            throw err;
        }
    }, []);

    // 开始录音
    const startRecording = useCallback(async () => {
        try {
            setError(null);
            setRecordedSamples(0);

            if (!audioContextRef.current) {
                await initializeAudio();
            }

            // 恢复音频上下文
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            // 开始录音
            workletNodeRef.current.port.postMessage({ type: 'start' });
            setIsRecording(true);

        } catch (err) {
            setError('开始录音失败: ' + err.message);
        }
    }, [initializeAudio]);

    // 停止录音
    const stopRecording = useCallback(() => {
        if (workletNodeRef.current && isRecording) {
            workletNodeRef.current.port.postMessage({ type: 'stop' });
        }
        setIsRecording(false);
    }, [isRecording]);

    // 获取录制的PCM数据
    const getRecordedData = useCallback(() => {
        if (!recordedDataRef.current || recordedSamples === 0) {
            return null;
        }

        // 返回实际录制的数据切片
        return recordedDataRef.current.slice(0, recordedSamples);
    }, [recordedSamples]);

    // 组件卸载时清理资源
    React.useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    if (!isSupported) {
        return (
            <Alert
                message="浏览器不支持"
                description="您的浏览器不支持AudioWorklet或SharedArrayBuffer功能"
                type="error"
                showIcon
            />
        );
    }

    return (
        <div style={{ padding: '20px', maxWidth: '400px' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space>
                    <Button
                        type={isRecording ? "default" : "primary"}
                        onClick={startRecording}
                        disabled={isRecording}
                        size="large"
                    >
                        开始录音
                    </Button>

                    <Button
                        type="primary"
                        danger
                        onClick={stopRecording}
                        disabled={!isRecording}
                        size="large"
                    >
                        停止录音
                    </Button>
                </Space>

                {isRecording && (
                    <Text type="success">🔴 正在录音中...</Text>
                )}

                {recordedSamples > 0 && (
                    <div>
                        <Text>已录制样本数: {recordedSamples.toLocaleString()}</Text>
                        <br />
                        <Text type="secondary">
                            录制时长: {(recordedSamples / 44100).toFixed(2)} 秒
                        </Text>
                    </div>
                )}

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        closable
                        onClose={() => setError(null)}
                    />
                )}

                {recordedSamples > 0 && (
                    <Button
                        onClick={() => {
                            const data = getRecordedData();
                            if (data) {
                                console.log('PCM数据:', data);
                                console.log('数据长度:', data.length);
                                console.log('采样率: 44.1kHz, 单声道, 32位浮点');
                                alert(`PCM数据已输出到控制台\n样本数: ${data.length}\n时长: ${(data.length / 44100).toFixed(2)}秒`);
                            }
                        }}
                    >
                        获取PCM数据
                    </Button>
                )}
            </Space>
        </div>
    );
};

export default ClaudePCMAudioRecorder;
