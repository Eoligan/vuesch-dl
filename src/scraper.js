import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import VideoDownloader from "./utils/videoDownloader.js";

export default class Scraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.videoDownloader = null;
    }

    async init() {
        this.browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        this.page = await this.browser.newPage();
        this.videoDownloader = new VideoDownloader(this.page);
    }
    async login(email, password) {
        await this.page.goto("https://vueschool.io/login", {
            waitUntil: "networkidle0",
        });

        // Check if input fields are already available before waiting
        const inputExists = await this.page.evaluate(() => {
            return document.querySelector("input") !== null;
        });

        // Only wait if inputs don't already exist
        if (!inputExists) {
            await this.page.waitForSelector("input", { timeout: 2000 });
        }

        // Try different selectors for email and password
        try {
            // Try by placeholder
            await this.page.type('input[placeholder*="email" i]', email);
        } catch (error) {
            try {
                // Try by type
                await this.page.type('input[type="email"]', email);
            } catch (error) {
                try {
                    // Try first input
                    await this.page.type("form input:nth-of-type(1)", email);
                } catch (error) {
                    console.error("Could not find email input field");
                    throw error;
                }
            }
        }

        try {
            // Try by placeholder
            await this.page.type('input[placeholder*="password" i]', password);
        } catch (error) {
            try {
                // Try by type
                await this.page.type('input[type="password"]', password);
            } catch (error) {
                try {
                    // Try second input
                    await this.page.type("form input:nth-of-type(2)", password);
                } catch (error) {
                    console.error("Could not find password input field");
                    throw error;
                }
            }
        }

        // Try to find the submit button
        try {
            // Click the button that looks like a submit button
            await this.page.click('button[type="submit"]');
        } catch (error) {
            try {
                // Try by text content
                await this.page.evaluate(() => {
                    const loginButtons = Array.from(
                        document.querySelectorAll("button")
                    ).filter(
                        (button) =>
                            button.textContent
                                .toLowerCase()
                                .includes("log in") ||
                            button.textContent
                                .toLowerCase()
                                .includes("sign in") ||
                            button.textContent.toLowerCase().includes("login")
                    );
                    if (loginButtons.length > 0) {
                        loginButtons[0].click();
                        return true;
                    }
                    return false;
                });
            } catch (error) {
                console.error("Could not find login button");
                throw error;
            }
        }

        // Check if we've already navigated before waiting
        try {
            // First check if we're already on a different page
            const currentUrl = this.page.url();
            if (!currentUrl.includes("/login")) {
                // Removed console.log
            } else {
                // Only wait for navigation if we're still on login page
                await this.page.waitForNavigation({
                    waitUntil: "networkidle0",
                    timeout: 5000,
                });
            }
            // Removed console.log
        } catch (error) {
            console.log(
                "Navigation timeout, but login might still be successful"
            );
        }
    }
    async getCourseData(courseUrl) {
        await this.page.goto(courseUrl, { waitUntil: "networkidle0" });

        // Check if course content elements already exist
        const contentExists = await this.page.evaluate(() => {
            return (
                document.querySelector(
                    'h1, .course-header__title, [class*="curriculum"], [class*="lessons"]'
                ) !== null
            );
        });

        // Only wait if content doesn't already exist
        if (!contentExists) {
            await this.page.waitForSelector(
                'h1, .course-header__title, [class*="curriculum"], [class*="lessons"]',
                {
                    timeout: 2000,
                }
            );
        }

        // Updated selectors for course content based on the current Vue School site structure
        const courseData = await this.page.evaluate(() => {
            // Get the course title
            const title =
                document.querySelector("h1")?.innerText ||
                document.querySelector(".course-header__title")?.innerText ||
                document.querySelector('[class*="title"]')?.innerText ||
                "Unknown Course";

            // Try multiple selectors to find lesson elements
            let lessonElements = [];

            // Option 1: Try to find lessons in the course curriculum section
            const curriculumSection =
                document.querySelector('[id*="curriculum"]') ||
                document.querySelector('[class*="curriculum"]') ||
                document.querySelector('[class*="lessons"]');

            if (curriculumSection) {
                lessonElements =
                    curriculumSection.querySelectorAll("li") ||
                    curriculumSection.querySelectorAll('[class*="lesson"]') ||
                    curriculumSection.querySelectorAll('a[href*="/lessons/"]');
            }

            // Option 2: If no lessons found, try to find them directly
            if (lessonElements.length === 0) {
                lessonElements =
                    document.querySelectorAll('a[href*="/lessons/"]') ||
                    document.querySelectorAll('[class*="lesson-item"]') ||
                    document.querySelectorAll('[class*="lesson_item"]');
            }

            // Option 3: Look for any links that might be lessons
            if (lessonElements.length === 0) {
                lessonElements = Array.from(
                    document.querySelectorAll("a")
                ).filter(
                    (a) =>
                        a.href.includes("/lessons/") ||
                        a.textContent.toLowerCase().includes("lesson") ||
                        a.parentElement.textContent
                            .toLowerCase()
                            .includes("lesson")
                );
            }

            // Extract video information
            const videos = Array.from(lessonElements)
                .map((item, index) => {
                    // Try to find the title
                    const titleElement =
                        item.querySelector('[class*="title"]') ||
                        item.querySelector("h3") ||
                        item.querySelector("h4") ||
                        item;

                    // Get the URL
                    const linkElement =
                        item.tagName === "A" ? item : item.querySelector("a");

                    // Try to find duration
                    const durationElement =
                        item.querySelector('[class*="duration"]') ||
                        item.querySelector("span:last-child") ||
                        item.querySelector("small");

                    return {
                        title:
                            titleElement.innerText.trim() ||
                            `Lesson ${index + 1}`,
                        url: linkElement?.href || "",
                        duration: durationElement?.innerText.trim() || "",
                    };
                })
                .filter((video) => video.url); // Only keep videos with URLs

            return { title, videos };
        });

        console.log(
            `Course data retrieved: ${courseData.title} with ${courseData.videos.length} videos`
        );
        return courseData;
    }
    async downloadCourse(courseUrl, outputDir = "./downloads", retryCount = 0, maxRetries = 5) {
        console.log(`Downloading course: ${courseUrl}`);
        const courseData = await this.getCourseData(courseUrl);
    
        // Create directory for the course
        const courseDir = path.join(
            outputDir,
            courseData.title.replace(/[/\\?%*:|"<>]/g, "-")
        );
        await fs.mkdir(courseDir, { recursive: true });
    
        console.log(`Course: ${courseData.title}`);
        console.log(`Found ${courseData.videos.length} videos`);
        console.log(`Output directory: ${courseDir}`);
    
        // Use the lessonsToDownload array if it exists, otherwise download all
        const indexesToDownload =
            this.lessonsToDownload ||
            Array.from({ length: courseData.videos.length }, (_, i) => i);
    
        // Download only the specified lessons
        for (const index of indexesToDownload) {
            const video = courseData.videos[index];
            const videoNumber = String(index + 1).padStart(2, "0");
            const videoTitle = video.title.replace(/[/\\?%*:|"<>]/g, "-");
            const outputPath = path.join(
                courseDir,
                `${videoNumber}-${videoTitle}.mp4`
            );
    
            console.log(
                `Downloading (${index + 1}/${courseData.videos.length}): ${
                    video.title
                }`
            );
            console.log(`URL: ${video.url}`);
            await this.downloadVideo(video.url, outputPath);
        }
    
        // Verify all lessons were downloaded successfully
        console.log("Verifying downloaded files...");
        const files = await fs.readdir(courseDir);
    
        // Use the identifyMissingLessons function from courseVerifier.js
        const { identifyMissingLessons } = await import(
            "./utils/courseVerifier.js"
        );
        const missingLessons = await identifyMissingLessons(
            files,
            courseData.videos.length,
            retryCount,
            maxRetries
        );
    
        // If there are missing lessons, retry downloading them
        if (missingLessons.length > 0) {
            console.log(
                `Found ${missingLessons.length} missing lessons. Retry attempt ${retryCount + 1}/${maxRetries}...`
            );
            this.lessonsToDownload = missingLessons;
            await this.downloadCourse(courseUrl, outputDir, retryCount + 1, maxRetries);
        } else {
            console.log(`Course downloaded successfully: ${courseData.title}`);
        }
    }
    async downloadAllCourses(outputDir = "./downloads") {
        await this.page.goto("https://vueschool.io/courses", {
            waitUntil: "networkidle0",
        });

        const courseUrls = await this.page.evaluate(() => {
            return Array.from(document.querySelectorAll(".course-card a"))
                .map((a) => a.href)
                .filter((url) => url.includes("/courses/"));
        });

        console.log(`Found ${courseUrls.length} courses`);

        for (const courseUrl of courseUrls) {
            await this.downloadCourse(courseUrl, outputDir);
        }
    }
    // Add waitForTimeout as a separate method of the class
    async waitForTimeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async downloadVideo(videoUrl, outputPath) {
        return await this.videoDownloader.downloadVideo(videoUrl, outputPath);
    }
    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}
