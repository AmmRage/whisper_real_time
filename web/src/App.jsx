import {useState} from 'react'
import Recorder from './components/recorder/Recorder.jsx'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import AudioRecorder from "./components/AudioRecorder/index.jsx";
import RecordView from "./components/AudioRecorder/index.jsx";
import OpenAI_Deprecated_API_PCMMicrophoneRecorder from "./components/OpenAI_Deprecated_API_PCMMicrophoneRecorder/index.jsx";
import DeepSeekAudioWorkletRecorder from "./components/DeepSeekAudioWorkletRecorder/index.jsx";
import ClaudePCMAudioRecorder from "./components/ClaudePCMAudioRecorder/index.jsx";

function App() {
    const [count, setCount] = useState(0);

    const onClick = () => {
        fetch('http://127.0.0.1:8000/', {
            method: 'GET',
            headers: {'Content-Type': 'application/json'}
        }).then(r => r.json()).then(console.log).catch(console.error);
    }


    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src={viteLogo} className="logo" alt="Vite logo"/>
                </a>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo"/>
                </a>

                {/*<RecordView />*/}

                {/*<Recorder/>*/}

                {/*<OpenAI_Deprecated_API_PCMMicrophoneRecorder />*/}

                <DeepSeekAudioWorkletRecorder />

                {/*<ClaudePCMAudioRecorder />*/}
            </div>
            <h1>Vite + React</h1>
            <div className="card">
                <button onClick={() => onClick()}>
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.jsx</code> and save to test HMR
                </p>
            </div>
            <p className="read-the-docs">
                Click on the Vite and React logos to learn more
            </p>
        </>
    )
}

export default App
