import fs from 'fs/promises';
import path from 'path';

/**
 * Verifies the status of a course's downloaded content and determines which lessons need to be downloaded
 * @param {Object} scraper - The scraper instance
 * @param {string} courseUrl - URL of the course to verify
 * @param {string} outputDir - Directory where courses are saved
 * @param {boolean} forceDownload - Whether to force download regardless of existing files
 * @returns {Promise<{skipDownload: boolean, lessonsToDownload: number[]}>}
 */
export async function verifyCourseStatus(scraper, courseUrl, outputDir, forceDownload = false) {
    if (forceDownload) {
        return { skipDownload: false, lessonsToDownload: null };
    }

    try {
        const courseData = await scraper.getCourseData(courseUrl);
        const courseDir = path.join(outputDir, courseData.title.replace(/[/\\?%*:|"<>]/g, '-'));
        
        try {
            await fs.access(courseDir);
            console.log(`Course folder found: ${courseDir}`);
            
            const files = await fs.readdir(courseDir);
            const lessonsToDownload = await identifyMissingLessons(files, courseData.videos.length);
            
            if (lessonsToDownload.length > 0) {
                console.log(`Need to download lessons: ${lessonsToDownload.map(i => i + 1).join(', ')}`);
                return { skipDownload: false, lessonsToDownload };
            }
            
            console.log(`All ${courseData.videos.length} videos already downloaded. Skipping.`);
            return { skipDownload: true, lessonsToDownload: [] };
        } catch {
            console.log(`Course folder not found. Starting download...`);
            return { skipDownload: false, lessonsToDownload: null };
        }
    } catch (error) {
        console.error(`Error checking course folder: ${error.message}`);
        return { skipDownload: false, lessonsToDownload: null };
    }
}

/**
 * Identifies which lessons need to be downloaded based on existing files
 * @param {string[]} files - List of files in the course directory
 * @param {number} totalLessons - Total number of lessons in the course
 * @returns {Promise<number[]>} Array of lesson indices that need to be downloaded
 */
export async function identifyMissingLessons(files, totalLessons, retryCount = 0, maxRetries = 3) {
    // If we've reached the maximum number of retries, return an empty array to stop trying
    if (retryCount >= maxRetries) {
        console.log(`Maximum retry attempts (${maxRetries}) reached. Some lessons could not be downloaded.`);
        return [];
    }
    
    const lessonsToDownload = new Set();
    
    // Check incomplete files first
    const incompleteFiles = files.filter(file => 
        file.endsWith('.part') || file.endsWith('.ytdl')
    );
    
    // Add incomplete file numbers to download list
    incompleteFiles.forEach(file => {
        const match = file.match(/^(\d+)-/);
        if (match) {
            lessonsToDownload.add(parseInt(match[1]) - 1); // Convert to 0-based index
        }
    });
    
    // Create a map of existing complete files
    const existingFiles = new Map();
    
    // Count how many files exist for each lesson number (should be 2 - audio and video)
    files
        .filter(file => file.endsWith('.mp4') || file.endsWith('.m4a') || file.endsWith('.webm'))
        .forEach(file => {
            const match = file.match(/^(\d+)-/);
            if (match) {
                const lessonNum = parseInt(match[1]);
                existingFiles.set(lessonNum, (existingFiles.get(lessonNum) || 0) + 1);
            }
        });
    
    // Check for missing or incomplete files (should have 2 files per lesson)
    for (let i = 1; i <= totalLessons; i++) {
        const fileCount = existingFiles.get(i) || 0;
        if (fileCount < 2) {
            lessonsToDownload.add(i - 1); // Convert to 0-based index
        }
    }
    
    return Array.from(lessonsToDownload).sort((a, b) => a - b);
}