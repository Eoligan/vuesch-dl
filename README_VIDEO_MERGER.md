# Video Merger for VueSchool Downloader

This tool allows you to merge video and audio files downloaded from VueSchool into a single high-quality MP4 file.

## Requirements

-   Python 3.6 or higher
-   FFmpeg installed and available in the system PATH

## Installing Dependencies

### Install Python

Download and install Python from [python.org](https://www.python.org/downloads/)

### Install FFmpeg

1. Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html)
2. Make sure it's available in your system PATH

## Usage

### From the Command Line

```bash
# Merge all courses in the downloads folder
node src/utils/mergeVideos.js

# Specify a different input folder
node src/utils/mergeVideos.js -i "path/to/folder"

# Process a specific course
node src/utils/mergeVideos.js -c "Course Name"

# Keep original files after merging
node src/utils/mergeVideos.js -k
```

### From Code

```javascript
import { mergeVideos } from "./src/utils/mergeVideos.js";

// Merge all courses in the default downloads folder
await mergeVideos();

// Specify options
await mergeVideos({
    inputDir: "./path/to/folder",
    courseName: "Course Name", // optional
    keepOriginals: true, // keep original files
});
```

## File Structure

The tool looks for pairs of video and audio files with the following format:

-   Video: `01-Lesson Name.fhls-fastly_skyfire-XXX.mp4`
-   Audio: `01-Lesson Name.fhls-fastly_skyfire-audio-high-English.mp4`

By default, original files will be automatically moved to the recycle bin after a successful merge. This provides an extra layer of safety in case something goes wrong. If you want to keep the original files in their original location, use the `-k` option or `keepOriginals: true`.

Merged files will be saved in the `downloads` folder with the following structure:

```
downloads/
  Course Name/
    01-Lesson Name.mp4
    02-Lesson Name.mp4
    ...
```

## Workflow Integration

This tool can be integrated with the existing workflow to automatically merge files after downloading. To do this, you can modify the `scraper.js` file to call the `mergeVideos` function after completing a course download.
