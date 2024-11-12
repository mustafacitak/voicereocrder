import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Download, Trash2, Edit2, Check, Pause } from 'lucide-react';
import { AudioPlayer } from './components/AudioPlayer';
import { AudioControls } from './components/AudioControls';
import { convertAudioFormat } from './components/AudioProcessor';

interface Recording {
  id: number;
  url: string;
  name: string;
  blob: Blob;
  duration?: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showControlsId, setShowControlsId] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const timestamp = new Date().toISOString().slice(11, 19);
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => [...prev, {
          id: Date.now(),
          url,
          name: `Recording ${timestamp}`,
          blob,
          duration: recordingTime
        }]);
        setRecordingTime(0);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (!isPaused) {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      } else {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const deleteRecording = (id: number) => {
    setRecordings(prev => {
      const newRecordings = prev.filter(rec => rec.id !== id);
      prev.find(rec => rec.id === id)?.url && URL.revokeObjectURL(prev.find(rec => rec.id === id)!.url);
      return newRecordings;
    });
  };

  const downloadRecording = async (recording: Recording) => {
    try {
      const convertedBlob = await convertAudioFormat(recording.blob, 'mp3');
      const url = URL.createObjectURL(convertedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.name}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error converting audio:', error);
    }
  };

  const updateRecordingName = (id: number, newName: string) => {
    setRecordings(prev =>
      prev.map(rec =>
        rec.id === id ? { ...rec, name: newName } : rec
      )
    );
    setEditingId(null);
  };

  const handleProcessedAudio = (id: number, processedBlob: Blob) => {
    const url = URL.createObjectURL(processedBlob);
    setRecordings(prev =>
      prev.map(rec =>
        rec.id === id
          ? { ...rec, url, blob: processedBlob }
          : rec
      )
    );
    setShowControlsId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Voice Recorder</h1>
          
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="flex gap-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-6 rounded-full transition-all duration-300 ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>

              {isRecording && (
                <button
                  onClick={pauseRecording}
                  className="p-6 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-all duration-300"
                >
                  <Pause className="w-8 h-8 text-white" />
                </button>
              )}
            </div>

            {isRecording && (
              <div className="text-lg font-semibold text-gray-700">
                {isPaused ? 'Paused' : 'Recording'}: {formatTime(recordingTime)}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gray-50 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  {editingId === recording.id ? (
                    <input
                      type="text"
                      className="flex-1 px-2 py-1 border rounded mr-2"
                      value={recording.name}
                      onChange={(e) => {
                        setRecordings(prev =>
                          prev.map(rec =>
                            rec.id === recording.id
                              ? { ...rec, name: e.target.value }
                              : rec
                          )
                        );
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateRecordingName(recording.id, recording.name);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-700 font-medium">{recording.name}</span>
                  )}
                  
                  <div className="flex gap-2">
                    {editingId === recording.id ? (
                      <button
                        onClick={() => updateRecordingName(recording.id, recording.name)}
                        className="p-2 hover:bg-green-100 rounded-full transition-colors"
                      >
                        <Check className="w-5 h-5 text-green-600" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingId(recording.id)}
                        className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                      >
                        <Edit2 className="w-5 h-5 text-blue-600" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => downloadRecording(recording)}
                      className="p-2 hover:bg-green-100 rounded-full transition-colors"
                    >
                      <Download className="w-5 h-5 text-green-600" />
                    </button>
                    
                    <button
                      onClick={() => deleteRecording(recording.id)}
                      className="p-2 hover:bg-red-100 rounded-full transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                <AudioPlayer 
                  url={recording.url}
                  duration={recording.duration}
                />

                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowControlsId(showControlsId === recording.id ? null : recording.id)}
                    className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                  >
                    {showControlsId === recording.id ? 'Hide Controls' : 'Show Controls'}
                  </button>
                  {recording.duration && (
                    <span className="text-xs text-gray-500">
                      Duration: {formatTime(recording.duration)}
                    </span>
                  )}
                </div>

                {showControlsId === recording.id && (
                  <AudioControls
                    audioBlob={recording.blob}
                    onProcess={(processedBlob) => handleProcessedAudio(recording.id, processedBlob)}
                  />
                )}
              </div>
            ))}
            
            {recordings.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                No recordings yet. Click the microphone button to start recording.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;