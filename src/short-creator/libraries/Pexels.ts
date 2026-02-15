import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { logger } from "../../config";

export class Pexels {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async downloadImages(
    searchTerm: string,
    count: number,
    outputPath: string
  ): Promise<string[]> {
    logger.info(`📸 Searching Pexels for "${searchTerm}" images...`);

    try {
      // Use Pexels PHOTOS API (not videos)
      const response = await axios.get("https://api.pexels.com/v1/photos/search", {
        params: {
          query: `${searchTerm} black white portrait vintage historical`,
          per_page: Math.min(count, 80),
          orientation: "portrait",
          size: "large",
        },
        headers: {
          Authorization: this.apiKey,
        },
      });

      const photos = response.data.photos.slice(0, count);
      logger.info(`✅ Found ${photos.length} images`);

      // Create output directory
      fs.ensureDirSync(outputPath);

      const downloadedPaths: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const imageUrl = photo.src.large || photo.src.original;
        const fileName = `image_${String(i + 1).padStart(3, "0")}.jpg`;
        const filePath = path.join(outputPath, fileName);

        try {
          logger.info(`⬇️ Downloading ${fileName}...`);
          const imageResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
          });

          fs.writeFileSync(filePath, imageResponse.data);
          downloadedPaths.push(filePath);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          logger.error(`❌ Failed to download ${fileName}: ${error}`);
        }
      }

      logger.info(`✅ Downloaded ${downloadedPaths.length} images`);
      return downloadedPaths;
    } catch (error: any) {
      logger.error(`❌ Pexels API error: ${error.response?.data || error.message}`);
      throw error;
    }
  }
}
