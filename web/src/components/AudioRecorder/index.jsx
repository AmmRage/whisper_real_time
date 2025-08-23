import {useEffect, useRef} from "react";
import {ReactMediaRecorder} from "../ReactMediaRecorder/index.js";



const VideoPreview = ({ stream }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);
    if (!stream) {
        return null;
    }
    return <video ref={videoRef} width={500} height={500} autoPlay controls />;
};



const RecordView = () => {

    return (
    <div>
        <ReactMediaRecorder
            audio
            // customMediaStream={stream}
            blobPropertyBag={{ type: 'audio/wav' }}
            render={({ status, startRecording, stopRecording, mediaBlobUrl }) => (
                <div>
                    <p>{status}</p>
                    <button onClick={startRecording}>Start Recording</button>
                    <button onClick={stopRecording}>Stop Recording</button>
                    <video src={mediaBlobUrl} controls autoPlay loop />
                </div>
            )}
        />

        {/*<ReactMediaRecorder*/}
        {/*    video*/}
        {/*    render={({  status, startRecording, stopRecording, mediaBlobUrl,previewStream }) => {*/}
        {/*        return <div>*/}
        {/*            <p>{status}</p>*/}
        {/*            <button onClick={startRecording}>Start Recording</button>*/}
        {/*            <button onClick={stopRecording}>Stop Recording</button>*/}
        {/*            /!*<video src={mediaBlobUrl} controls autoPlay loop />*!/*/}
        {/*            <VideoPreview stream={previewStream} />*/}
        {/*        </div>*/}
        {/*        ;*/}
        {/*    }}*/}
        {/*/>*/}
    </div> );
}

export default RecordView;
