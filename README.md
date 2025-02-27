# Git Auto Commit CLI  

Git Auto Commit CLI is a simple tool to automate Git commits with automatically generated messages.  

## Installation  

Use the following command to install this package globally:  

```sh
npm install -g git-auto-commit-cli
```  

## Usage  

Run the following command to use this tool:  

```sh
git-auto-commit
```  

To generate commit messages in English, use:  

```sh
git-auto-commit --lang=en
```  

### API Key Requirement  

This tool requires a **Groq API Key** to function.  
The API key will be requested via a prompt when the tool is initialized for the first time.  
Your key will be stored securely for future use.  

This tool uses the Groq API and will generate five commit messages based on the code changes.  

## Contribution  

We welcome contributions from all developers! Follow these steps to contribute:  

1. **Fork the Repository**  
2. **Clone the Repository**:  
   ```sh
   git clone https://github.com/CahBantul/git-auto-commit-cli.git
   ```  
3. **Create a New Branch**:  
   ```sh
   git checkout -b branch-name
   ```  
4. **Make Changes & Commit**:  
   ```sh
   git commit -am "Description of changes"
   ```  
5. **Push to Remote**:  
   ```sh
   git push origin branch-name
   ```  
6. **Create a Pull Request** on GitHub.  

## License  

This project is released under the ISC license.  

---  
Created by Fardan Nozami Ajitama