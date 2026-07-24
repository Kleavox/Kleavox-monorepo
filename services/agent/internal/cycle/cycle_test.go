package cycle

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Kleavox/Kleavox-monorepo/services/agent/internal/reporter"
)

func TestExecuteReportsHeartbeatChecksAndConfiguredInterval(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	defer target.Close()

	pulse := &fakeReporter{
		heartbeat: reporter.HeartbeatResponse{OK: true, IntervalSeconds: 30},
		config: reporter.AgentConfig{
			NodeID:          "node-1",
			IntervalSeconds: 60,
			Checks: []reporter.Check{{
				ID: "http-1", Name: "Target", Kind: "HTTP",
				Target: target.URL, TimeoutSeconds: 2,
			}},
		},
	}
	host := reporter.Host{
		Hostname: "test-host", OperatingSystem: "linux",
		Architecture: "amd64", AgentVersion: "test",
	}

	interval, err := New(pulse, host).Execute(context.Background(), "node-1")
	if err != nil {
		t.Fatalf("execute cycle: %v", err)
	}
	if interval != 60 {
		t.Fatalf("expected configured interval 60, got %d", interval)
	}
	if pulse.receivedHeartbeat.NodeID != "node-1" || pulse.receivedHeartbeat.Host != host {
		t.Fatalf("unexpected heartbeat: %#v", pulse.receivedHeartbeat)
	}
	if len(pulse.results) != 1 || pulse.results[0].Status != "UP" {
		t.Fatalf("expected one UP result, got %#v", pulse.results)
	}
}

func TestExecuteFallsBackToHeartbeatInterval(t *testing.T) {
	pulse := &fakeReporter{
		heartbeat: reporter.HeartbeatResponse{OK: true, IntervalSeconds: 45},
		config:    reporter.AgentConfig{NodeID: "node-1"},
	}

	interval, err := New(pulse, reporter.Host{}).Execute(context.Background(), "node-1")
	if err != nil {
		t.Fatalf("execute cycle: %v", err)
	}
	if interval != 45 {
		t.Fatalf("expected heartbeat interval 45, got %d", interval)
	}
}

func TestExecuteStopsBeforeChecksWhenHeartbeatFails(t *testing.T) {
	pulse := &fakeReporter{
		heartbeatError: &reporter.ResponseError{Status: 401, Body: "invalid agent"},
	}

	_, err := New(pulse, reporter.Host{}).Execute(context.Background(), "node-1")
	if err == nil || err.Error() != "heartbeat failed with HTTP 401: invalid agent" {
		t.Fatalf("unexpected error: %v", err)
	}
	if pulse.fetchConfigCalled {
		t.Fatal("config must not be fetched after heartbeat failure")
	}
}

type fakeReporter struct {
	heartbeat         reporter.HeartbeatResponse
	heartbeatError    error
	config            reporter.AgentConfig
	configError       error
	resultsError      error
	receivedHeartbeat reporter.Heartbeat
	results           []reporter.CheckResult
	fetchConfigCalled bool
}

func (pulse *fakeReporter) SendHeartbeat(
	_ context.Context,
	heartbeat reporter.Heartbeat,
) (reporter.HeartbeatResponse, error) {
	pulse.receivedHeartbeat = heartbeat
	return pulse.heartbeat, pulse.heartbeatError
}

func (pulse *fakeReporter) FetchConfig(context.Context) (reporter.AgentConfig, error) {
	pulse.fetchConfigCalled = true
	return pulse.config, pulse.configError
}

func (pulse *fakeReporter) SendResults(
	_ context.Context,
	_ string,
	results []reporter.CheckResult,
) error {
	pulse.results = results
	return pulse.resultsError
}

var _ Reporter = (*fakeReporter)(nil)
