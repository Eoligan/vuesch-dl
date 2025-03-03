#!/usr/bin/env node
import { program } from "commander";
import Scraper from "./scraper.js";
import { verifyCourseStatus } from "./utils/courseVerifier.js";

program
    .argument("[courseUrl]", "Course URL to download")
    .option("-e, --email <email>", "Your email")
    .option("-p, --password <password>", "Your password")
    .option("-d, --directory <directory>", "Directory to save", "./downloads")
    .option("-a, --all", "Get all courses")
    .option("-f, --force", "Force download even if course exists")
    .parse();

const options = program.opts();

/**
 * Wrapper around verifyCourseStatus that sets the lessonsToDownload property on the scraper
 * @param {Object} scraper - The scraper instance
 * @param {string} courseUrl - URL of the course to verify
 * @param {string} outputDir - Directory where courses are saved
 * @returns {Promise<boolean>} Whether to skip download
 */
async function checkCourseFolder(scraper, courseUrl, outputDir) {
    const { skipDownload, lessonsToDownload } = await verifyCourseStatus(
        scraper,
        courseUrl,
        outputDir,
        options.force
    );

    if (lessonsToDownload) {
        scraper.lessonsToDownload = lessonsToDownload;
    }

    return skipDownload;
}

/**
 * Main application function
 */
async function main() {
    const outputDir = options.directory || "./downloads";
    const scraper = new Scraper();

    try {
        await scraper.init();

        // Validate credentials
        if (!options.email || !options.password) {
            console.error("Email and password are required");
            process.exit(1);
        }

        await scraper.login(options.email, options.password);

        if (options.all) {
            await scraper.downloadAllCourses(outputDir);
        } else {
            const courseUrl = program.args[0];
            if (!courseUrl) {
                console.error(
                    "Please provide a course URL or use --all option"
                );
                process.exit(1);
            }

            const skipDownload = await checkCourseFolder(
                scraper,
                courseUrl,
                outputDir
            );
            if (!skipDownload) {
                await scraper.downloadCourse(courseUrl, outputDir);
            }
        }
    } catch (error) {
        console.error(`Error in main process: ${error.message}`);
        process.exit(1);
    } finally {
        await scraper.close();
    }
}

main().catch(console.error);
