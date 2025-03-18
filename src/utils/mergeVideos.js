#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

/**
 * Wrapper function to execute the Python video merger script
 * @param {Object} options - Configuration options
 * @param {string} options.inputDir - Directory containing course folders (default: './downloads')
 * @param {string} options.courseName - Specific course to process (optional)
 * @param {boolean} options.keepOriginals - Whether to keep original files after merging (default: false)
 * @returns {Promise<boolean>} - Whether the merge was successful
 */
export async function mergeVideos(options = {}) {
    const {
        inputDir = "./downloads",
        courseName,
        keepOriginals = false,
    } = options;

    try {
        // Check if Python is installed
        await checkPythonInstalled();

        // Check if FFmpeg is installed
        await checkFFmpegInstalled();

        // Check if send2trash Python package is installed
        await checkSend2TrashInstalled();

        // Path to the Python script
        const scriptPath = path.join(
            process.cwd(),
            "src",
            "utils",
            "videoMerger.py"
        );

        // Ensure the script exists
        await fs.access(scriptPath);

        // Build command arguments
        const args = [scriptPath];
        if (inputDir) {
            args.push("-i", inputDir);
        }
        if (courseName) {
            args.push("-c", courseName);
        }

        if (keepOriginals) {
            args.push("-k");
        }

        console.log("Starting video merge process...");

        // Execute the Python script
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", args, { stdio: "inherit" });

            pythonProcess.on("close", (code) => {
                if (code === 0) {
                    console.log("Video merge process completed successfully.");
                    resolve(true);
                } else {
                    console.error(
                        `Video merge process failed with code ${code}`
                    );
                    resolve(false);
                }
            });

            pythonProcess.on("error", (err) => {
                console.error(`Error executing Python script: ${err.message}`);
                reject(err);
            });
        });
    } catch (error) {
        console.error(`Error in mergeVideos: ${error.message}`);
        return false;
    }
}

/**
 * Check if Python is installed
 * @returns {Promise<void>}
 * @throws {Error} If Python is not installed
 */
async function checkPythonInstalled() {
    try {
        await new Promise((resolve, reject) => {
            const pythonProcess = spawn("python", ["--version"]);

            pythonProcess.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error("Python is not installed or not in PATH"));
                }
            });

            pythonProcess.on("error", () => {
                reject(new Error("Python is not installed or not in PATH"));
            });
        });
    } catch (error) {
        console.error("Python is required to merge video files.");
        console.error(
            "Please install Python from https://www.python.org/downloads/"
        );
        throw error;
    }
}

/**
 * Check if FFmpeg is installed
 * @returns {Promise<void>}
 * @throws {Error} If FFmpeg is not installed
 */
async function checkFFmpegInstalled() {
    try {
        await new Promise((resolve, reject) => {
            const ffmpegProcess = spawn("ffmpeg", ["-version"]);

            ffmpegProcess.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error("FFmpeg is not installed or not in PATH"));
                }
            });

            ffmpegProcess.on("error", () => {
                reject(new Error("FFmpeg is not installed or not in PATH"));
            });
        });
    } catch (error) {
        console.error("FFmpeg is required to merge video files.");
        console.error(
            "Please install FFmpeg from https://ffmpeg.org/download.html"
        );
        throw error;
    }
}

/**
 * Check if send2trash Python package is installed and install it if not
 * @returns {Promise<void>}
 */
async function checkSend2TrashInstalled() {
    try {
        await new Promise((resolve, reject) => {
            // Check if send2trash is installed
            const pythonProcess = spawn("python", ["-c", "import send2trash"]);

            pythonProcess.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    console.log("Installing send2trash Python package...");
                    // If not installed, install it
                    const pipProcess = spawn("pip", ["install", "send2trash"]);

                    pipProcess.on("close", (pipCode) => {
                        if (pipCode === 0) {
                            console.log(
                                "send2trash package installed successfully."
                            );
                            resolve();
                        } else {
                            reject(
                                new Error(
                                    "Failed to install send2trash package"
                                )
                            );
                        }
                    });

                    pipProcess.on("error", (err) => {
                        reject(
                            new Error(
                                `Error installing send2trash: ${err.message}`
                            )
                        );
                    });
                }
            });

            pythonProcess.on("error", (err) => {
                reject(
                    new Error(`Error checking for send2trash: ${err.message}`)
                );
            });
        });
    } catch (error) {
        console.error("Failed to ensure send2trash package is installed.");
        console.error(error.message);
        throw error;
    }
}

// If this script is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    const options = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-i" || args[i] === "--input") {
            options.inputDir = args[i + 1];
            i++;
        } else if (args[i] === "-c" || args[i] === "--course") {
            options.courseName = args[i + 1];
            i++;
        } else if (args[i] === "-k" || args[i] === "--keep") {
            options.keepOriginals = true;
        }
    }

    mergeVideos(options)
        .then((success) => {
            process.exit(success ? 0 : 1);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
