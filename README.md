<p align="center">
  <img src="src/assets/meridian_full_logo.png" alt="Meridian" width="600" />
</p>

# Meridian — Navigate Your Growth

**Meridian** is a visual, AI-powered goal navigation desktop app. It's built around a simple idea: Providing structure for long-term growth by breaking goals down.

> ⚠️ **Work in Progress** — This is an active personal project. The codebase is functional but still evolving. Contributions and feedback are welcome as it matures.

---

## Features

- **Goal Tracking** — Create SMART goals with AI-generated subtasks and milestone checkpoints
- **Onward Planner** — A daily timeline view for scheduling tasks without rigid time-blocking
- **Skill Tracking** — Evidence-based skill development with proficiency stages and status tracking
- **NOVA AI Companion** — Context-aware AI that learns your work patterns, suggests plans, and provides reflective check-ins
- **Knowledge Pool** — Persistent memory of your preferences, work style, and goals that informs AI suggestions
- **Pomodoro Timer** — Built-in focus sessions with task linking
- **Tracking & Analytics** — Daily/weekly/monthly stats on completions, streaks, and time distribution
- **Constellation Map** — Visual canvas showing all your goals as an interactive solar system
- **Electron Desktop App** — Runs as a native app with tray icon, morning prompts, and offline persistence

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 |
| Build Tool | Vite 8 |
| Desktop Shell | Electron 41 |
| Database | better-sqlite3 |
| AI Backend | OpenRouter API (model-agnostic) |
| Rich Text | TipTap editor |
| Styling | CSS-in-JS (template literals) |
| Fonts | Syne + IBM Plex Mono |

---

## Prerequisites

- **Node.js** >= 22
- **npm** (comes with Node.js)
- An **OpenRouter API key** (free tier available) for AI features

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/meridian-app.git
cd meridian-app

# Install dependencies
npm install

# Run in development mode (web only)
npm run dev

# Run with Electron desktop shell
npm run dev:all

# Build for production
npm run build
```

### First Launch

1. Launch the app — you'll be prompted for an API key
2. Get a free API key from [OpenRouter](https://openrouter.ai/)
3. Paste it into the 'Config' screen
4. Start creating goals and exploring

---

## Project Structure

```
meridian-app/
├── main.js              # Electron main process
├── preload.js           # Electron preload (secure IPC bridge)
├── vite.config.js       # Vite configuration
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # React entry point
│   ├── index.css        # Global styles
│   ├── components/      # React UI components
│   │   ├── views/       # Page-level views (Focus, Pomodoro, Skills, etc.)
│   │   ├── panels/      # Panel components (GoalModal, etc.)
│   │   └── nova/        # NOVA AI companion components
│   ├── hooks/           # Custom React hooks
│   ├── utils/           # Utility modules (API, canvas, helpers, retry logic)
│   ├── constants/       # Constants (colors, skills definitions)
│   └── db/              # Database schema
```

---

## Configuration

All configuration is done through the app's Settings page:

- **API Key** — Your OpenRouter API key (stored encrypted via Electron's `safeStorage`)
- **AI Model** — Choose which model to use (default: `meta-llama/llama-3.1-8b-instruct:free`)
- **Morning Prompt Time** — Set a time for automatic daily check-in

---

## License

[MIT](LICENSE)

---

## Acknowledgments

Built with React, Electron, Vite, and the OpenRouter community.
