# Zarkiv Agent

The Zarkiv Agent is the lightweight Pulse daemon installed on monitored Linux
hosts. It collects bounded host metrics and sends authenticated heartbeats to
Pulse.

```bash
go build -o bin/zarkiv-agent ./cmd/agent
./bin/zarkiv-agent --config ./config.example.json --once
```

Enroll once, then install the systemd service:

```bash
sudo zarkiv-agent enroll \
  --endpoint https://pulse.zarkiv.com \
  --token <one-time-token>
sudo zarkiv-agent install-service
```

The enrollment flow writes `/etc/zarkiv-agent/config.json` with mode `0600`.
Pulse stores only SHA-256 hashes of enrollment and agent credentials. The agent
supports HTTP, TCP, and systemd-service checks; it does not expose a remote
shell.
