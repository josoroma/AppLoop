# Finding Which Port a Generated Project Is Running On

When multiple Next.js dev servers are running (common with many generated projects), identifying which port belongs to a specific project is non-obvious.

## Quick approach — let Next.js tell you

Try to start the project on a free port. If it's already running, Next.js reports the existing port and PID:

```bash
cd .apploop/projects/<slug> && npm run dev -- --port <free-port>
# Output: "Another next dev server is already running on port 3114 — PID 21227"
```

## When the quick approach fails (stuck servers)

Stuck servers may not report conflicts because the port is bound but Next.js's IPC check can't reach it.

### Step 1: Find the PID with project files open

```bash
lsof | grep "<project-slug>" | grep "next" | head -5
```

This finds any `node` process that has files from the project's `.apploop/projects/<slug>` directory open. Look at the PID column.

### Step 2: Check if that PID is alive

```bash
ps -p <pid> -o pid,state,command=
```

If the process is dead (stale lsof entry), it's a zombie — the real server may be on a different PID.

### Step 3: Find the port from the PID

```bash
lsof -p <pid> -i -P | grep LISTEN
```

The port is in the `NAME` column (e.g., `TCP localhost:3114 (LISTEN)`).

### Step 4: Verify it serves the right project

```bash
curl -s --max-time 5 http://127.0.0.1:<port>/ | grep -o "template-[a-z-]*"
```

The body classname (`template-ai-engineer-cv`, `template-admin-luma`, etc.) confirms which project.

## Fallback: scan all ports

```bash
for port in $(seq 3100 3199); do
  body=$(curl -s --max-time 2 http://127.0.0.1:$port/ 2>/dev/null)
  if echo "$body" | grep -q "<unique-project-marker>"; then
    echo "FOUND on port $port"
    break
  fi
done
```

Use a unique string from the project's page content (e.g., a specific `data-builder-id` value, project title, or unique text).

Note: this scan is slow (~2s per port, up to 3 minutes for 100 ports) and times out on stuck servers.
