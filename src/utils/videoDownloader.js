import fs from 'fs/promises';
import path from 'path';
import { execa } from 'execa';

export default class VideoDownloader {
    constructor(page) {
        this.page = page;
    }

    async waitForTimeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async downloadVideo(videoUrl, outputPath) {
        // Path to yt-dlp executable
        const ytdlpDir = path.join(process.cwd(), "bin");
        const ytdlpPath = path.join(ytdlpDir, "yt-dlp.exe");

        try {
            // Navigate to video page to get updated cookies
            await this.page.goto(videoUrl, { waitUntil: "networkidle0" });

            // Wait for Vimeo iframe to appear
            const iframeExists = await this.page.evaluate(() => {
                return document.querySelector('iframe[src*="player.vimeo.com"]') !== null;
            });

            if (!iframeExists) {
                await this.page.waitForFunction(
                    () => document.querySelector('iframe[src*="player.vimeo.com"]') !== null,
                    { timeout: 3000, polling: 50 }
                );
            }

            // Extract URL from Vimeo iframe
            const videoData = await this.page.evaluate(() => {
                const vimeoIframe = document.querySelector('iframe[src*="player.vimeo.com"]');
                return vimeoIframe ? {
                    type: "vimeo_iframe",
                    url: vimeoIframe.src
                } : null;
            });

            if (!videoData?.type === "vimeo_iframe") {
                throw new Error("No Vimeo video found on page");
            }

            const vimeoIdMatch = videoData.url.match(/video\/(\d+)/);
            const vimeoId = vimeoIdMatch?.[1];

            if (!vimeoId) {
                throw new Error("Could not extract Vimeo video ID");
            }

            const vimeoUrl = `https://player.vimeo.com/video/${vimeoId}`;
            const options = [
                "--format",
                "bestvideo[height<=720]+bestaudio/best[height<=720]",
                "--merge-output-format",
                "mp4",
                "--referer",
                videoUrl,
                "--add-header",
                `Referer: ${videoUrl}`,
                "--user-agent",
                await this.page.evaluate(() => navigator.userAgent),
                "-o",
                outputPath
            ];

            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`Attempting to download from Vimeo (attempt ${attempt}/${maxRetries}): ${vimeoUrl}`);

                    if (attempt > 1) {
                        console.log("Waiting 2 seconds before retry...");
                        await this.waitForTimeout(2000);
                        options.push("--force-overwrites");
                    }

                    await execa(ytdlpPath, [...options, vimeoUrl]);
                    console.log(`✓ Video downloaded: ${path.basename(outputPath)}`);
                    await this.cleanupTempFiles(outputPath);
                    return true;

                } catch (error) {
                    console.error(`Error in attempt ${attempt}: ${error.message}`);
                    if (error.message.includes("acceso al archivo") || error.message.includes("access")) {
                        await this.cleanupTempFiles(outputPath);
                    }
                    if (attempt === maxRetries) {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error(`Error downloading video: ${error.message}`);
            return false;
        }
    }

    async cleanupTempFiles(outputPath) {
        const baseFileName = path.basename(outputPath, ".mp4");
        const dirName = path.dirname(outputPath);

        try {
            const files = await fs.readdir(dirName);
            for (const file of files) {
                if (file.startsWith(baseFileName) && (file.endsWith(".part") || file.endsWith(".ytdl") || file.endsWith(".temp"))) {
                    const tempFilePath = path.join(dirName, file);
                    try {
                        await fs.unlink(tempFilePath);
                        console.log(`Cleaned up temporary file: ${file}`);
                    } catch (e) {
                        // Ignore errors if file doesn't exist or can't be accessed
                    }
                }
            }
        } catch (error) {
            console.log(`Warning: Could not clean up some temporary files: ${error.message}`);
        }
    }
}