import React, { useState } from 'react';
import { Slider } from './Slider';
import { processAudio, AudioProcessingOptions } from './AudioProcessor';

interface AudioControlsProps {
  onProcess: (blob: Blob) => void;
  audioBlob: Blob;
}

export function AudioControls({ onProcess, audioBlob }: AudioControlsProps) {
  const [options, setOptions] = useState<AudioProcessingOptions>({
    noiseReduction: 0.5,
    removeBackground: false,
    gain: 1,
    clarity: 0.5
  });

  const handleProcess = async () => {
    const processedBlob = await processAudio(audioBlob, options);
    onProcess(processedBlob);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <div className="space-y-2">
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Noise Reduction</span>
          <Slider
            value={options.noiseReduction}
            onChange={(value) => setOptions(prev => ({ ...prev, noiseReduction: value }))}
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Volume</span>
          <Slider
            value={options.gain}
            min={0}
            max={2}
            step={0.1}
            onChange={(value) => setOptions(prev => ({ ...prev, gain: value }))}
          />
        </label>

        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Clarity</span>
          <Slider
            value={options.clarity}
            onChange={(value) => setOptions(prev => ({ ...prev, clarity: value }))}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={options.removeBackground}
            onChange={(e) => setOptions(prev => ({ ...prev, removeBackground: e.target.checked }))}
            className="rounded text-blue-600"
          />
          <span className="text-sm text-gray-600">Remove Background Noise</span>
        </label>
      </div>

      <button
        onClick={handleProcess}
        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        Apply Changes
      </button>
    </div>
  );
}