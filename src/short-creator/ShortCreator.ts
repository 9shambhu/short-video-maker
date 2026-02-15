import fs from 'fs';
import path from 'path';
import { Kokoro } from './libraries/kokoro';
import { Pexels } from './libraries/pexels';
import { Whisper } from './libraries/whisper';
import { compositionProps } from '../config';

export interface ShortCreatorInput {
  script: string;
  searchTerm: string;
  outputDir?: string;
}

export class ShortCreator {
  async createShort(input: ShortCreatorInput) {
    const { script, searchTerm, outputDir = 'temp' } = input;

    const audioDir = path.join(outputDir, 'audio');
    const imagesDir = path.join(outputDir, 'images');
    
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Step 1: Generate English TTS audio
    console.log('🎙️ Generating English TTS audio...');
    const kokoro = new Kokoro();
    const audioPath = await kokoro.tts({
      text: script,
      outputPath: path.join(audioDir, 'tts.mp3'),
    });
    console.log(`✅ Audio saved to ${audioPath}`);

    // Step 2: Get IMAGES from Pexels (NOT videos)
    console.log('📸 Fetching images from Pexels...');
    const pexels = new Pexels();
    const imagePaths = await pexels.getImages(searchTerm, 60);
    
    if (imagePaths.length === 0) {
      throw new Error('No images found from Pexels');
    }
    console.log(`✅ Got ${imagePaths.length} images`);

    // Step 3: Generate subtitles
    console.log('💬 Generating subtitles...');
    const whisper = new Whisper();
    const segments = await whisper.transcribe(audioPath);
    console.log(`✅ Generated ${segments.length} subtitle segments`);

    // Step 4: Calculate duration
    const audioDuration = segments.reduce((acc, curr) => Math.max(acc, curr.end), 0);
    const videoDurationInFrames = Math.ceil(audioDuration * compositionProps.fps);

    return {
      audioPath,
      images: imagePaths,
      subtitles: segments,
      videoDurationInFrames,
    };
  }
}
