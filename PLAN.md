# Plan: Vue TS Projekt mit OpenCode PR-Reviewer

## Ziel
Ein einfaches Vue TypeScript Projekt mit GitHub Workflow, der OpenCode als automatischen PR-Reviewer nutzt.

## Aufgaben

### Phase 1: Projekt-Struktur ✅
- [x] Vue TypeScript Projekt via Vite erstellen
- [x] Dependencies installieren

### Phase 2: OpenCode Konfiguration
- [x] `agent/code-review.md` — Review Subagent Prompt (von elithrar/dotfiles)
- [x] `command/code-review.md` — Review Command (von elithrar/dotfiles)
- [ ] `settings.yaml` — OpenCode Einstellungen (optional)

### Phase 3: GitHub Workflow
- [x] `.github/workflows/pr-review.yml` — Triggered bei PR
- [ ] Workflow anpassen (Input-Methode für Diff)
- [ ] OpenCode Docker Command korrekt konfigurieren

### Phase 4: Testen
- [ ] Einen Dummy-PR erstellen
- [ ] Workflow verifizieren

## Architektur

```
PR-reviewer-Example/
├── .github/
│   └── workflows/
│       └── pr-review.yml      # OpenCode PR Reviewer
├── .config/
│   └── opencode/
│       ├── agent/
│       │   └── code-review.md # Review Subagent
│       ├── command/
│       │   └── code-review.md # Review Command
│       └── settings.yaml      # OpenCode Config
├── src/
│   └── ...                    # Vue TS App
├── package.json
└── README.md
```

## Workflow-Logik

1. **Trigger**: Bei jedem `pull_request` (open, synchronize)
2. **Steps**:
   - Checkout Code
   - Docker Image für OpenCode laden
   - Git Diff zwischen Base und Head holen
   - OpenCode mit Code-Review Command ausführen
   - Ergebnis als PR Comment posten
3. **Env Vars**:
   - `OPENCODE_API_KEY` (für Zen oder eigene LLM)
   - `GITHUB_TOKEN` (für Comment-Posting)