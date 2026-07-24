package cycle

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/Kleavox/Kleavox-monorepo/services/agent/internal/checks"
	"github.com/Kleavox/Kleavox-monorepo/services/agent/internal/metrics"
	"github.com/Kleavox/Kleavox-monorepo/services/agent/internal/reporter"
)

type Reporter interface {
	SendHeartbeat(context.Context, reporter.Heartbeat) (reporter.HeartbeatResponse, error)
	FetchConfig(context.Context) (reporter.AgentConfig, error)
	SendResults(context.Context, string, []reporter.CheckResult) error
}

type Cycle interface {
	Execute(context.Context, string) (int, error)
}

type implementation struct {
	reporter Reporter
	host     reporter.Host
}

func New(pulse Reporter, host reporter.Host) Cycle {
	return &implementation{reporter: pulse, host: host}
}

func (cycle *implementation) Execute(ctx context.Context, nodeID string) (int, error) {
	snapshot, err := metrics.Collect()
	if err != nil {
		return 0, fmt.Errorf("collect metrics: %w", err)
	}
	heartbeat, err := cycle.reporter.SendHeartbeat(ctx, reporter.Heartbeat{
		NodeID:  nodeID,
		Host:    cycle.host,
		Metrics: snapshot,
	})
	if err != nil {
		return 0, describeResponseError("heartbeat", err)
	}

	agentConfig, err := cycle.reporter.FetchConfig(ctx)
	if err != nil {
		return 0, describeResponseError("fetch checks", err)
	}
	results := checks.RunAll(ctx, agentConfig.Checks)
	if err := cycle.reporter.SendResults(ctx, nodeID, results); err != nil {
		return 0, describeResponseError("report checks", err)
	}
	if agentConfig.IntervalSeconds > 0 {
		return agentConfig.IntervalSeconds, nil
	}
	return heartbeat.IntervalSeconds, nil
}

func describeResponseError(action string, err error) error {
	var responseError *reporter.ResponseError
	if errors.As(err, &responseError) {
		return fmt.Errorf(
			"%s failed with HTTP %d: %s",
			action,
			responseError.Status,
			strings.TrimSpace(responseError.Body),
		)
	}
	return fmt.Errorf("%s failed: %w", action, err)
}
