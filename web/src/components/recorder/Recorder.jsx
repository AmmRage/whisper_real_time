import React, {useState, useRef} from 'react';
import {Button, message} from 'antd';
import {MediaRecorder as ExtendableMediaRecorder, register} from 'extendable-media-recorder';
import './Recorder.css';


const Recorder = () => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    // 直接音频数据
    const audioChunksRef = useRef([]);

    const startRecording = async () => {
        if (isRecording) return;

        try {
            // 1. 获取麦克风权限和音频流

            const stream = await navigator.mediaDevices.getUserMedia({audio: true});
            streamRef.current = stream;


            // 2. 创建 MediaRecorder 实例
            mediaRecorderRef.current = new ExtendableMediaRecorder(stream);

            // 3. 监听 dataavailable 事件，原始格式
            // timeslice: 2000 毫秒，表示每 2 秒触发一次该事件
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    console.log('录音数据可用:', event.data.size);
                    audioChunksRef.current.push(event.data);
                    // 4. 每两秒发送数据到后端
                    sendAudioData(event.data);
                }
            };


            // 监听录音停止事件
            mediaRecorderRef.current.onstop = () => {
                // 在这里可以处理录音完全停止后的逻辑，比如发送最后一段数据
                // 如果录音停止时 audioChunksRef 里还有数据，可以发送
            };

            mediaRecorderRef.current.start(2000); // 启动录音，并设置 timeslice 为 2000ms
            setIsRecording(true);
            message.success('开始录音...');
        } catch (err) {
            console.error('获取麦克风权限失败:', err);
            message.error('无法访问麦克风，请检查权限设置');
        }
    };

    const stopRecording = () => {
        if (!isRecording) return;

        // 停止录音
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        // 停止麦克风流
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        setIsRecording(false);
        audioChunksRef.current = []; // 清空数据
        message.info('录音已结束');
    };

    const sendAudioData = async (blob) => {
        console.log('正在发送数据到后端，大小:', blob.size, '字节');
        // 这里是模拟的后端发送逻辑，实际应用中替换为你的 API
        // 例如:
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        try {
            const response = await fetch('http://127.0.0.1:8000/asr2', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                console.log('数据发送成功:', response);
            } else {
                console.error('数据发送失败');
            }
        } catch (error) {
            console.error('发送请求时出错:', error);
        }
    };

    return (
        <div className="recorder-container">
            <Button
                className="record-button"
                type="primary"
                shape="circle"
                size="large"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
            >
        <span className="button-text">
          {isRecording ? '录音中...' : '按住说话'}
        </span>
            </Button>
        </div>
    );
};

export default Recorder;
