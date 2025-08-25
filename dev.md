# dev

## backend

```bash
python main.py
```

## dev journal

recorded how started and what learned

### start

understand there are two options to record audio in frontend

1. use `MediaRecorder`
2. use `AudioContext` and `ScriptProcessorNode` which is deprecated (but still works so far) and replaced by `AudioWorkletNode`

The first option is easier to implement and has better browser support, but the second option gives more control over the audio data and allows for real-time processing.

I chose the first option for simplicity and thought it is sufficient for my needs.

### trial 1

add `MediaRecorder` to react based web app is kinda easy stuff

create FastAPI backend to receive audio blob and save to file is also easy stuff

after save and use whisper to transcribe the first audio file works but following up chunks encounter error

the learned that, the supported `webm` is not the correct option.

that time thought maybe some other open source component project may work, tried a few but none did.

## trial 2

Finally found the `MediaRecorder` is not the right choice.

Then created new component base on `AudioContext`.

it records audio in PCM and only need to fill in a few header bytes to make it a valid `wav` file.

send to backend and save it, then use whisper to transcribe it, works like a charm.

learned from the orig author's `transcribe_demo.py` file about the usage of transcribe data from ram instead of file system.

### trial 3

create an other function to send pure pcm data to backend and use `scipy` to do re-sample.

at the time, I was working my desktop with multiple audio input source.

somehow, it by default selected the wrong one, during testing there was no output.

subsequently, add a dropdown to select the input source.

after fix some small bugs, it works.

## TODO

- [ ] mobile test
- [ ] decrease the record time make it more `realtime`
- [ ] add window in backend