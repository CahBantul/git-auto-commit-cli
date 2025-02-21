#!/usr/bin/env node

import {execSync} from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import Groq from 'groq-sdk';

const CONFIG_PATH = path.join(
    process.env.HOME || process.env.USERPROFILE || '.',
    '.git-auto-commit-config.json'
);
const MODEL = 'llama-3.3-70b-versatile';

async function getApiKey() {
    if (fs.existsSync(CONFIG_PATH)) {
        const config = fs.readJsonSync(CONFIG_PATH);
        if (config.apiKey) return config.apiKey;
    }

    const {apiKey} = await inquirer.prompt([
        {
            type: 'input',
            name: 'apiKey',
            message: chalk.cyan('Masukkan Groq API Key Anda:'),
            validate: (input) =>
                input.trim() !== '' || chalk.red('API Key tidak boleh kosong!'),
        },
    ]);

    fs.writeJsonSync(CONFIG_PATH, {apiKey}, {spaces: 2});
    return apiKey;
}

function getChangedFiles() {
    try {
        const output = execSync('git status --porcelain', {encoding: 'utf-8'});
        return output
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line) => line.split(' ').pop());
    } catch (error) {
        console.error(
            chalk.red('Gagal mendapatkan daftar file yang diubah:'),
            error
        );
        return [];
    }
}

const systemMessage = `
    Anda adalah ahli dalam menganalisis perubahan pada git diff.

    Ikuti aturan berikut untuk pesan commit:
    1. Format: <type>[scope]([konteks opsional]): <deskripsi lengkap>

    2. Gunakan aturan Conventional Commits dengan jenis scope yang sesuai.

    3. Pesan commit harus memiliki minimal 90 karakter dan maksimal 110 karakter.

    4. Pesan harus lebih teknis, mencantumkan nama file atau fungsi yang relevan.
    `;

async function getCommitMessages(apiKey: string, gitDiff: string) {
    if (!gitDiff) {
        console.log(
            chalk.yellow('Tidak ada perubahan terdeteksi di git diff.')
        );
        return ['Update code'];
    }

    try {
        const groq = new Groq({apiKey});
        const completion = await groq.chat.completions.create({
            messages: [
                {role: 'system', content: systemMessage},
                {
                    role: 'user',
                    content: `Buatkan 5 pesan commit untuk perubahan berikut:\n\n${gitDiff}`,
                },
            ],
            model: MODEL,
        });

        if (
            completion.choices.length > 0 &&
            completion.choices[0].message?.content
        ) {
            return completion.choices[0].message.content
                .split('\n')
                .filter((line) => /^\d+\.\s/.test(line))
                .map((line) =>
                    line.replace(/^\d+\.\s*/, '').replace(/^"|"$/g, '')
                )
                .slice(0, 5);
        } else {
            console.error(chalk.red('Response dari Groq tidak valid.'));
            return ['Update code'];
        }
    } catch (error) {
        console.error(chalk.red('Gagal mengambil commit messages:'), error);
        return ['Update code'];
    }
}

async function main() {
    try {
        const changedFiles = getChangedFiles();

        if (changedFiles.length === 0) {
            console.log(
                chalk.yellow('Tidak ada perubahan yang perlu dikomit.')
            );
            return;
        }

        const {selectedFiles} = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedFiles',
                message: chalk.cyan(
                    'Pilih file yang ingin ditambahkan ke commit:'
                ),
                choices: [
                    {name: 'Semua file', value: '--all'},
                    ...changedFiles.map((file) => ({name: file, value: file})),
                ],
            },
        ]);

        if (selectedFiles.length === 0) {
            console.log(
                chalk.yellow('Tidak ada file yang dipilih. Proses dihentikan.')
            );
            return;
        }

        if (selectedFiles.includes('--all')) {
            execSync('git add .', {stdio: 'inherit'});
        } else {
            execSync(`git add ${selectedFiles.join(' ')}`, {stdio: 'inherit'});
        }

        const apiKey = await getApiKey();
        const gitDiff = getGitDiff();
        const messages = await getCommitMessages(apiKey, gitDiff);

        const {commitMessage} = await inquirer.prompt([
            {
                type: 'list',
                name: 'commitMessage',
                message: chalk.cyan('Pilih pesan commit:'),
                choices: messages,
            },
        ]);

        execSync(`git commit -m "${commitMessage}"`, {stdio: 'inherit'});

        console.log(chalk.green(`✅ Berhasil commit: "${commitMessage}"`));
    } catch (error) {
        console.error(chalk.red('Terjadi kesalahan:'), error);
    }
}

function getGitDiff() {
    try {
        const output = execSync('git diff --staged --stat', { encoding: 'utf-8' });
        return output.trim();
    } catch (error) {
        console.error(chalk.red('Gagal mendapatkan git diff:'), error);
        return '';
    }
}

main();
