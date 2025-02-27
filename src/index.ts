#!/usr/bin/env node

import { execSync } from "child_process";
import inquirer from "inquirer";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import Groq from "groq-sdk";

// Konfigurasi file API Key
const CONFIG_PATH = path.join(
    process.env.HOME || process.env.USERPROFILE || ".",
    ".git-auto-commit-config.json"
);
const MODEL = "llama-3.3-70b-versatile";

// Deteksi bahasa dari argumen CLI
const args = process.argv.slice(2);
const lang = args.includes("--lang=en") ? "en" : "id"; 

// Pesan sistem sesuai bahasa
const systemMessages = {
    en: `
        You are an expert in analyzing git diff changes.

        Follow these rules for commit messages:
        1. Format: <type>: <full description>
        2. Use Conventional Commit rules with an appropriate scope.
        3. Commit messages should be at least 90 characters and at most 110 characters.
        4. Messages must be technical, referencing relevant files or functions.
    `,
    id: `
        Anda adalah ahli dalam menganalisis perubahan pada git diff.

        Ikuti aturan berikut untuk pesan commit:
        1. Format: <type>: <deskripsi lengkap>
        2. Gunakan aturan Conventional Commits dengan jenis scope yang sesuai.
        3. Pesan commit harus memiliki minimal 90 karakter dan maksimal 110 karakter.
        4. Pesan harus lebih teknis, mencantumkan nama file atau fungsi yang relevan.
    `,
};

async function getApiKey() {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = fs.readJsonSync(CONFIG_PATH);
        if (config.apiKey) return config.apiKey;
    }

    const { apiKey } = await inquirer.prompt([
        {
            type: "input",
            name: "apiKey",
            message: chalk.cyan(lang === "en" ? "Enter your Groq API Key:" : "Masukkan Groq API Key Anda:"),
            validate: (input) => input.trim() !== "" || chalk.red(lang === "en" ? "API Key cannot be empty!" : "API Key tidak boleh kosong!"),
        },
    ]);

    fs.writeJsonSync(CONFIG_PATH, { apiKey }, { spaces: 2 });
    return apiKey;
}

function getChangedFiles() {
    try {
        const output = execSync("git status --porcelain", { encoding: "utf-8" });
        return output
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => line.split(" ").pop());
    } catch (error) {
        console.error(chalk.red(lang === "en" ? "Failed to get changed files:" : "Gagal mendapatkan daftar file yang diubah:"), error);
        return [];
    }
}

async function getCommitMessages(apiKey : string, gitDiff : string) {
    if (!gitDiff) {
        console.log(chalk.yellow(lang === "en" ? "No changes detected in git diff." : "Tidak ada perubahan terdeteksi di git diff."));
        return ["Update code"];
    }

    try {
        const groq = new Groq({ apiKey });
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemMessages[lang] },
                {
                    role: "user",
                    content: lang === "en" 
                        ? `Generate 5 commit messages for the following changes:\n\n${gitDiff}`
                        : `Buatkan 5 pesan commit untuk perubahan berikut:\n\n${gitDiff}`,
                },
            ],
            model: MODEL,
        });

        if (completion.choices.length > 0 && completion.choices[0].message?.content) {
            return completion.choices[0].message.content
                .split("\n")
                .filter((line) => /^\d+\.\s/.test(line))
                .map((line) => line.replace(/^\d+\.\s*/, "").replace(/^"|"$/g, ""))
                .slice(0, 5);
        } else {
            console.error(chalk.red(lang === "en" ? "Invalid response from Groq." : "Response dari Groq tidak valid."));
            return ["Update code"];
        }
    } catch (error) {
        console.error(chalk.red(lang === "en" ? "Failed to fetch commit messages:" : "Gagal mengambil commit messages:"), error);
        return ["Update code"];
    }
}

async function main() {
    try {
        const changedFiles = getChangedFiles();

        if (changedFiles.length === 0) {
            console.log(chalk.yellow(lang === "en" ? "No changes to commit." : "Tidak ada perubahan yang perlu dikomit."));
            return;
        }

        const { selectedFiles } = await inquirer.prompt([
            {
                type: "checkbox",
                name: "selectedFiles",
                message: chalk.cyan(lang === "en" ? "Select files to commit:" : "Pilih file yang ingin ditambahkan ke commit:"),
                choices: [
                    { name: lang === "en" ? "All files" : "Semua file", value: "--all" },
                    ...changedFiles.map((file) => ({ name: file, value: file })),
                ],
            },
        ]);

        if (selectedFiles.length === 0) {
            console.log(chalk.yellow(lang === "en" ? "No files selected. Process aborted." : "Tidak ada file yang dipilih. Proses dihentikan."));
            return;
        }

        if (selectedFiles.includes("--all")) {
            execSync("git add .", { stdio: "inherit" });
        } else {
            execSync(`git add ${selectedFiles.join(" ")}`, { stdio: "inherit" });
        }

        const apiKey = await getApiKey();
        const gitDiff = getGitDiff();
        const messages = await getCommitMessages(apiKey, gitDiff);

        const { commitMessage } = await inquirer.prompt([
            {
                type: "list",
                name: "commitMessage",
                message: chalk.cyan(lang === "en" ? "Choose a commit message:" : "Pilih pesan commit:"),
                choices: messages,
            },
        ]);

        execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });

        console.log(chalk.green(`✅ ${lang === "en" ? "Successfully committed:" : "Berhasil commit:"} "${commitMessage}"`));
    } catch (error) {
        console.error(chalk.red(lang === "en" ? "An error occurred:" : "Terjadi kesalahan:"), error);
    }
}

function getGitDiff() {
    try {
        const output = execSync("git diff --staged --stat", { encoding: "utf-8" });
        return output.trim();
    } catch (error) {
        console.error(chalk.red(lang === "en" ? "Failed to get git diff:" : "Gagal mendapatkan git diff:"), error);
        return "";
    }
}

main();
