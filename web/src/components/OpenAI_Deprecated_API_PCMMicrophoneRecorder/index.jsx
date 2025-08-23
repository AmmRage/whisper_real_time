import React, { useState, useRef } from 'react';
import { Button, Space, Typography } from 'antd';

const { Text } = Typography;

const OpenAI_Deprecated_API_PCMMicrophoneRecorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [sampleRate, setSampleRate] = useState(null);
    const [logData, setLogData] = useState('');
    const stopFnRef = useRef(null);

    const recordPCM = async (onData) => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const source = ctx.createMediaStreamSource(stream);

        const processor = ctx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(ctx.destination);

        processor.onaudioprocess = (e) => {
            onData(e.inputBuffer.getChannelData(0), ctx.sampleRate);
        };

        let stopped = false;
        return () => {
            if (stopped) return;
            stopped = true;
            processor.disconnect();
            source.disconnect();
            stream.getTracks().forEach(t => t.stop());
            ctx.close();
        };
    };

    const handleStartRecording = async () => {
        setIsRecording(true);
        setLogData('');

        try {
            stopFnRef.current = await recordPCM((chunk, sampleRate) => {
                setSampleRate(sampleRate);

                const head = Array.from(chunk.slice(0, 8)).map(v => v.toFixed(6));
                const newLogEntry =
                    `收到 PCM 块: 长度=${chunk.length}\n` +
                    `示例样本[0..7]= ${head.join(', ')}\n\n`;

                setLogData(prev => newLogEntry + prev);
            });
        } catch (err) {
            setLogData('获取麦克风失败: ' + err);
            setIsRecording(false);
        }
    };

    const handleStopRecording = () => {
        if (stopFnRef.current) {
            stopFnRef.current();
            stopFnRef.current = null;
        }
        setIsRecording(false);
    };

    return (
        <div>
            <Space>
                <Button
                    type="primary"
                    onClick={handleStartRecording}
                    disabled={isRecording}
                >
                    开始录音
                </Button>
                <Button
                    danger
                    onClick={handleStopRecording}
                    disabled={!isRecording}
                >
                    停止
                </Button>
            </Space>

            <div style={{ marginTop: 16 }}>
                <Text>采样率：{sampleRate ? `${sampleRate} Hz` : 'N/A'}</Text>
            </div>

            <div
                style={{
                    whiteSpace: 'pre-wrap',
                    background: '#f6f8fa',
                    padding: 12,
                    borderRadius: 8,
                    maxHeight: '50vh',
                    overflow: 'auto',
                    marginTop: 16
                }}
            >
                {logData}
            </div>
        </div>
    );
};

export default OpenAI_Deprecated_API_PCMMicrophoneRecorder;
