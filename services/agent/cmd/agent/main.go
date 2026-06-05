package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"os/user"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/zarkiv/agent/internal/checks"
	"github.com/zarkiv/agent/internal/config"
	"github.com/zarkiv/agent/internal/metrics"
	"github.com/zarkiv/agent/internal/reporter"
)

var version = "dev"

const defaultConfigPath = "/etc/zarkiv-agent/config.json"

func main() {
	if err := run(os.Args[1:]); err != nil {
		log.Fatal(err)
	}
}

func run(args []string) error {
	command := "run"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		command = args[0]
		args = args[1:]
	}

	switch command {
	case "run":
		return runDaemon(args, false)
	case "once":
		return runDaemon(args, true)
	case "enroll":
		return enroll(args)
	case "status":
		return status(args)
	case "install-service":
		return installService(args)
	case "uninstall-service":
		return uninstallService()
	case "version":
		fmt.Println(version)
		return nil
	default:
		return fmt.Errorf("unknown command %q", command)
	}
}

func enroll(args []string) error {
	flags := flag.NewFlagSet("enroll", flag.ContinueOnError)
	endpoint := flags.String("endpoint", "https://pulse.zarkiv.com", "Pulse endpoint")
	token := flags.String("token", "", "one-time enrollment token")
	configPath := flags.String("config", defaultConfigPath, "configuration path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if strings.TrimSpace(*token) == "" {
		return fmt.Errorf("--token is required")
	}

	host, err := currentHost()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	enrollment, err := reporter.New(*endpoint, *token, version).Enroll(ctx, host)
	if err != nil {
		return describeResponseError("enrollment", err)
	}

	cfg := config.Config{
		Endpoint:        *endpoint,
		NodeID:          enrollment.NodeID,
		Token:           enrollment.Token,
		IntervalSeconds: enrollment.IntervalSeconds,
	}
	if err := config.Save(*configPath, cfg); err != nil {
		return err
	}
	fmt.Printf("Enrolled node %s and wrote %s\n", enrollment.NodeID, *configPath)
	return nil
}

func runDaemon(args []string, once bool) error {
	flags := flag.NewFlagSet("run", flag.ContinueOnError)
	configPath := flags.String("config", defaultConfigPath, "configuration path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	cfg, err := config.Load(*configPath)
	if err != nil {
		return err
	}
	client := reporter.New(cfg.Endpoint, cfg.Token, version)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if once {
		_, err := executeCycle(ctx, client, cfg.NodeID)
		return err
	}

	log.Printf("zarkiv-agent %s started for node %s", version, cfg.NodeID)
	interval := cfg.Interval
	for {
		started := time.Now()
		nextInterval, err := executeCycle(ctx, client, cfg.NodeID)
		if err != nil {
			log.Printf("monitoring cycle failed: %v", err)
		} else if nextInterval >= 15 && nextInterval <= 3600 {
			interval = time.Duration(nextInterval) * time.Second
		}
		wait := interval - time.Since(started)
		if wait < time.Second {
			wait = time.Second
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			log.Print("zarkiv-agent stopped")
			return nil
		case <-timer.C:
		}
	}
}

func executeCycle(ctx context.Context, client *reporter.Client, nodeID string) (int, error) {
	snapshot, err := metrics.Collect()
	if err != nil {
		return 0, fmt.Errorf("collect metrics: %w", err)
	}
	host, err := currentHost()
	if err != nil {
		return 0, err
	}
	heartbeat, err := client.SendHeartbeat(ctx, reporter.Heartbeat{
		NodeID: nodeID, Host: host, Metrics: snapshot,
	})
	if err != nil {
		return 0, describeResponseError("heartbeat", err)
	}

	agentConfig, err := client.FetchConfig(ctx)
	if err != nil {
		return 0, describeResponseError("fetch checks", err)
	}
	results := checks.RunAll(ctx, agentConfig.Checks)
	if err := client.SendResults(ctx, nodeID, results); err != nil {
		return 0, describeResponseError("report checks", err)
	}
	if agentConfig.IntervalSeconds > 0 {
		return agentConfig.IntervalSeconds, nil
	}
	return heartbeat.IntervalSeconds, nil
}

func status(args []string) error {
	flags := flag.NewFlagSet("status", flag.ContinueOnError)
	configPath := flags.String("config", defaultConfigPath, "configuration path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	cfg, err := config.Load(*configPath)
	if err != nil {
		return err
	}
	fmt.Printf("Node: %s\nEndpoint: %s\nInterval: %s\n", cfg.NodeID, cfg.Endpoint, cfg.Interval)
	return nil
}

func installService(args []string) error {
	if runtime.GOOS != "linux" {
		return fmt.Errorf("systemd installation is supported only on Linux")
	}
	if os.Geteuid() != 0 {
		return fmt.Errorf("install-service must run as root")
	}
	flags := flag.NewFlagSet("install-service", flag.ContinueOnError)
	configPath := flags.String("config", defaultConfigPath, "configuration path")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if _, err := config.Load(*configPath); err != nil {
		return err
	}
	if err := ensureServiceUser(*configPath); err != nil {
		return err
	}
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	executable, err = filepath.EvalSymlinks(executable)
	if err != nil {
		return err
	}

	unit := fmt.Sprintf(`[Unit]
Description=Zarkiv Pulse Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=zarkiv-agent
Group=zarkiv-agent
ExecStart=%s run --config %s
Restart=always
RestartSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
LockPersonality=true
MemoryDenyWriteExecute=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
`, executable, *configPath)
	if err := os.WriteFile("/etc/systemd/system/zarkiv-agent.service", []byte(unit), 0o644); err != nil {
		return err
	}
	if err := exec.Command("systemctl", "daemon-reload").Run(); err != nil {
		return err
	}
	if err := exec.Command("systemctl", "enable", "--now", "zarkiv-agent.service").Run(); err != nil {
		return err
	}
	fmt.Println("Installed and started zarkiv-agent.service")
	return nil
}

func ensureServiceUser(configPath string) error {
	account, err := user.Lookup("zarkiv-agent")
	if err != nil {
		if createErr := exec.Command(
			"useradd", "--system", "--home-dir", "/nonexistent",
			"--shell", "/usr/sbin/nologin", "zarkiv-agent",
		).Run(); createErr != nil {
			return fmt.Errorf("create zarkiv-agent user: %w", createErr)
		}
		account, err = user.Lookup("zarkiv-agent")
		if err != nil {
			return fmt.Errorf("lookup zarkiv-agent user: %w", err)
		}
	}
	uid, err := strconv.Atoi(account.Uid)
	if err != nil {
		return err
	}
	gid, err := strconv.Atoi(account.Gid)
	if err != nil {
		return err
	}
	if err := os.Chown(configPath, uid, gid); err != nil {
		return fmt.Errorf("set config ownership: %w", err)
	}
	return os.Chmod(configPath, 0o600)
}

func uninstallService() error {
	if runtime.GOOS != "linux" || os.Geteuid() != 0 {
		return fmt.Errorf("uninstall-service must run as root on Linux")
	}
	_ = exec.Command("systemctl", "disable", "--now", "zarkiv-agent.service").Run()
	if err := os.Remove("/etc/systemd/system/zarkiv-agent.service"); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return exec.Command("systemctl", "daemon-reload").Run()
}

func currentHost() (reporter.Host, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return reporter.Host{}, fmt.Errorf("read hostname: %w", err)
	}
	return reporter.Host{
		Hostname: hostname, OperatingSystem: runtime.GOOS,
		Architecture: runtime.GOARCH, AgentVersion: version,
	}, nil
}

func describeResponseError(action string, err error) error {
	var responseError *reporter.ResponseError
	if errors.As(err, &responseError) {
		return fmt.Errorf("%s failed with HTTP %d: %s", action, responseError.Status, strings.TrimSpace(responseError.Body))
	}
	return fmt.Errorf("%s failed: %w", action, err)
}
