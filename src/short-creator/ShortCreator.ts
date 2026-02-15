import path from "path";
import fs from "fs-extra";
import { Config } from "../config";
import { Kokoro } from "./libraries/kokoro";
import { Pexels } from "./libraries/pexels";
import { Whisper } from "./libraries/whisper";
import { logger } from "../config";

export interface ShortCreatorInput {
  script: string;
  searchTerm: string;
  outputVideoPath: string;
}

export class ShortCreator {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async createShort(input: ShortCreatorInput): Promise<string> {
    const { script, searchTerm, outputVideoPath } = input;
    const tempDir = path.join(this.config.tempDirPath, Date.now().toString());
    fs.ensureDirSync(tempDir);

    try {
      // Step 1: Generate English TTS audio (Kokoro)
      logger.info("🎙️ Generating English TTS audio...");
      const kokoro = new Kokoro(this.config);
      const audioPath = path.join(tempDir, "audio.mp3");
      await kokoro.tts({ text: script, outputPath: audioPath });
      logger.info(`✅ Audio saved to ${audioPath}`);

      // Step 2: Get IMAGES from Pexels (NOT videos)
      logger.info("📸 Downloading images from Pexels...");
      const pexels = new Pexels(this.config.pexelsApiKey);
      const imagePaths = await pexels.downloadImages(
        searchTerm,
        60, // 60 images = 10 minutes @ 10 seconds each
        path.join(tempDir, "images")
      );

      if (imagePaths.length === 0) {
        throw new Error("No images downloaded from Pexels");
      }
      logger.info(`✅ Got ${imagePaths.length} images`);

      // Step 3: Apply B&W + yellow filter to ALL images using FFmpeg
      logger.info("🎨 Applying B&W + yellow tint filter to images...");
      const filteredImages: string[] = [];
      
      for (let i = 0; i < imagePaths.length; i++) {
        const inputPath = imagePaths[i];
        const outputPath = path.join(tempDir, "filtered", `image_${String(i + 1).padStart(3, "0")}.jpg`);
        fs.ensureDirSync(path.dirname(outputPath));

        // FFmpeg command: B&W + yellow tint (eye protection mode)
        const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -vf "format=gray,curves=all='0/0.1 0.6/0.85 1/1',eq=brightness=0.05:saturation=0.2" "${outputPath}"`;
        
        logger.info(`🖼️ Filtering image ${i + 1}/${imagePaths.length}`);
        await new Promise((resolve, reject) => {
          require("child_process").exec(ffmpegCmd, (error: any) => {
            if (error) reject(error);
            else resolve(outputPath);
          });
        });

        filteredImages.push(outputPath);
      }

      // Step 4: Create video from filtered images (10 seconds per image)
      logger.info("🎬 Creating video from images (10 seconds per image)...");
      const imagesTxtPath = path.join(tempDir, "images.txt");
      
      // Create FFmpeg concat file
      let concatContent = "";
      filteredImages.forEach((imgPath) => {
        concatContent += `file '${imgPath}'\nduration 10\n`;
      });
      // Add last image again to ensure full duration
      if (filteredImages.length > 0) {
        concatContent += `file '${filteredImages[filteredImages.length - 1]}'\n`;
      }
      fs.writeFileSync(imagesTxtPath, concatContent);

      // Create video from images
      const videoWithoutAudioPath = path.join(tempDir, "video_no_audio.mp4");
      const ffmpegImagesCmd = `ffmpeg -y -f concat -safe 0 -i "${imagesTxtPath}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -c:v libx264 -r 30 -pix_fmt yuv420p "${videoWithoutAudioPath}"`;
      
      await new Promise((resolve, reject) => {
        require("child_process").exec(ffmpegImagesCmd, (error: any) => {
          if (error) reject(error);
          else resolve(videoWithoutAudioPath);
        });
      });

      // Step 5: Add audio to video
      logger.info("🔊 Adding audio to video...");
      const ffmpegFinalCmd = `ffmpeg -y -i "${videoWithoutAudioPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputVideoPath}"`;
      
      await new Promise((resolve, reject) => {
        require("child_process").exec(ffmpegFinalCmd, (error: any) => {
          if (error) reject(error);
          else resolve(outputVideoPath);
        });
      });

      logger.info(`✅ Video created: ${outputVideoPath}`);
      return outputVideoPath;

    } catch (error) {
      logger.error(`❌ Video creation failed: ${error}`);
      throw error;
    } finally {
      // Optional: cleanup temp files
      // fs.removeSync(tempDir);
    }
  }
}
