import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export interface AudioProcessingOptions {
  noiseReduction: number; // 0-1
  removeBackground: boolean;
  gain: number; // 0-2
  clarity: number; // 0-1
}

let ffmpeg: FFmpeg | null = null;

async function initFFmpeg() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
    });
  }
  return ffmpeg;
}

export async function convertAudioFormat(blob: Blob, format: 'mp3' | 'wav' | 'ogg'): Promise<Blob> {
  const ffmpeg = await initFFmpeg();
  const inputFileName = 'input.webm';
  const outputFileName = `output.${format}`;
  
  // Write the input file to FFmpeg's virtual filesystem
  ffmpeg.writeFile(inputFileName, new Uint8Array(await blob.arrayBuffer()));
  
  // Run the conversion
  await ffmpeg.exec(['-i', inputFileName, outputFileName]);
  
  // Read the output file
  const data = await ffmpeg.readFile(outputFileName);
  const mimeTypes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg'
  };
  
  return new Blob([data], { type: mimeTypes[format] });
}

export async function processAudio(
  audioBlob: Blob,
  options: AudioProcessingOptions
): Promise<Blob> {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    
    fileReader.onloadend = async () => {
      const audioContext = new AudioContext();
      const audioData = await audioContext.decodeAudioData(fileReader.result as ArrayBuffer);
      
      const offlineContext = new OfflineAudioContext(
        audioData.numberOfChannels,
        audioData.length,
        audioData.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioData;
      
      // Noise reduction filter
      const lowpass = offlineContext.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 2000 + (options.noiseReduction * 2000); // 2000-4000Hz
      lowpass.Q.value = 0.5;
      
      // Background noise removal (high-pass filter)
      const highpass = offlineContext.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = options.removeBackground ? 150 : 20;
      highpass.Q.value = 0.5;
      
      // Gain node for volume adjustment
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = options.gain;
      
      // Clarity enhancement
      const presence = offlineContext.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3000;
      presence.Q.value = 0.7;
      presence.gain.value = options.clarity * 6; // 0-6dB boost
      
      // Connect nodes
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(presence);
      presence.connect(offlineContext.destination);
      
      // Process audio
      source.start(0);
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert back to blob
      const mediaStreamDestination = audioContext.createMediaStreamDestination();
      const bufferSource = audioContext.createBufferSource();
      bufferSource.buffer = renderedBuffer;
      bufferSource.connect(mediaStreamDestination);
      bufferSource.start(0);
      
      const mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const processedBlob = new Blob(chunks, { type: 'audio/webm' });
        resolve(processedBlob);
      };
      
      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), renderedBuffer.duration * 1000);
    };
    
    fileReader.readAsArrayBuffer(audioBlob);
  });
}