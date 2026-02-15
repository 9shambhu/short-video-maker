import axios from 'axios';
import fs from 'fs';
import path from 'path';

export class Pexels {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('PEXELS_API_KEY environment variable is required');
    }
  }

  async getImages(searchTerm: string, count: number = 60): Promise<string[]> {
    try {
      console.log(`📸 Fetching ${count} B&W images from Pexels for: "${searchTerm}"`);
      
      // Use Pexels PHOTOS API (not videos)
      const response = await axios.get('https://api.pexels.com/v1/photos/search', {
        params: {
          query: `${searchTerm} black white portrait vintage historical`,
          per_page: Math.min(count, 80),
          orientation: 'portrait',
          size: 'large'
        },
        headers: {
          Authorization: this.apiKey
        }
      });

      const photos = response.data.photos.slice(0, count);
      console.log(`✅ Found ${photos.length} images`);
      
      // Download images
      const outputDir = 'temp/images';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const imagePaths: string[] = [];
      
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const imageUrl = photo.src.large || photo.src.original;
        const fileName = `image_${String(i + 1).padStart(3, '0')}.jpg`;
        const outputPath = path.join(outputDir, fileName);

        try {
          console.log(`⬇️ Downloading ${fileName}...`);
          const imgResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer'
          });
          
          fs.writeFileSync(outputPath, imgResponse.data);
          imagePaths.push(outputPath);
          
          await new Promise(resolve => setTimeout(resolve, 150)); // Rate limit
          
        } catch (err) {
          console.error(`❌ Failed to download ${fileName}`);
        }
      }

      console.log(`✅ Downloaded ${imagePaths.length} images`);
      return imagePaths;
      
    } catch (error: any) {
      console.error('❌ Pexels API Error:', error.response?.data || error.message);
      throw error;
    }
  }
}
