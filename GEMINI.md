# Alumnigo (algo)

## Project Overview
AlumniGo is a modern, real-time alumni networking platform built for the Smart India Hackathon (SIH) 2025. It connects students, alumni, and institutions via community channels and blazing-fast messaging. 

**Tech Stack & Architecture:**
- **Backend (Python Flask):** Serves web pages, standard API endpoints, and handles core user authentication. (Runs on port 5000)
- **Backend (Go):** High-performance WebSocket server for real-time chat, presence, and Google OAuth handling. (Runs on port 8080)
- **Database:** PostgreSQL.
- **Frontend:** HTML templates, Vanilla JavaScript / TypeScript, and TailwindCSS for styling.

## Building and Running

### Prerequisites
- Python 3.11+
- Go 1.21+
- Node.js & npm (for Tailwind/TypeScript)
- PostgreSQL

### Setup & Installation
1. **Python Environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Go Dependencies:**
   ```bash
   cd app/src/ && go mod tidy && cd ../../
   ```
3. **Frontend Assets:**
   ```bash
   npm install
   npm run build # Builds Tailwind CSS and TypeScript
   ```
4. **Environment Variables:**
   ```bash
   cp .env.example .env
   # Ensure you configure your database and OAuth settings
   ```

### Running the Application
The easiest way to start both the Python and Go servers is by using the provided startup script:
```bash
./scripts/start-all.sh
```
*This automatically starts the Go WebSocket server on port 8080 and the Python Flask server on port 5000.*

**To run the frontend asset watcher during development:**
```bash
npm run watch
```

**Stopping the application:**
```bash
./scripts/cleanup.sh
```

## Development Conventions
- **Python:** Follow PEP 8 style guidelines.
- **Go:** Use `go fmt` for code formatting.
- **Commits:** Write descriptive commit messages.
- **Testing:** Add tests for new features (e.g., using `pytest`).
- **Structure:**
  - `app/src/`: Contains both Python and Go source code.
  - `app/static/`: Contains static assets (CSS, JS, TS, Images).
  - `app/templates/`: Contains Jinja/HTML templates.
