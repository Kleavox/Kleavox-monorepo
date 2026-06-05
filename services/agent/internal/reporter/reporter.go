package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/zarkiv/agent/internal/metrics"
)

type Host struct {
	Hostname        string `json:"hostname"`
	OperatingSystem string `json:"operatingSystem"`
	Architecture    string `json:"architecture"`
	AgentVersion    string `json:"agentVersion"`
}

type Enrollment struct {
	NodeID          string `json:"nodeId"`
	Token           string `json:"token"`
	IntervalSeconds int    `json:"intervalSeconds"`
}

type Heartbeat struct {
	NodeID string `json:"nodeId"`
	Host
	Metrics metrics.Snapshot `json:"metrics"`
}

type HeartbeatResponse struct {
	OK              bool `json:"ok"`
	IntervalSeconds int  `json:"intervalSeconds"`
}

type Check struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Kind           string `json:"kind"`
	Target         string `json:"target"`
	TimeoutSeconds int    `json:"timeout_seconds"`
}

type AgentConfig struct {
	NodeID          string  `json:"nodeId"`
	IntervalSeconds int     `json:"intervalSeconds"`
	Checks          []Check `json:"checks"`
}

type CheckResult struct {
	CheckID   string  `json:"checkId"`
	Status    string  `json:"status"`
	LatencyMS *int64  `json:"latencyMs"`
	Message   *string `json:"message"`
	CheckedAt string  `json:"checkedAt"`
}

type resultPayload struct {
	NodeID  string        `json:"nodeId"`
	Results []CheckResult `json:"results"`
}

type Client struct {
	endpoint   string
	token      string
	version    string
	httpClient *http.Client
}

type ResponseError struct {
	Status int
	Body   string
}

func (e *ResponseError) Error() string {
	return fmt.Sprintf("pulse returned HTTP %d", e.Status)
}

func New(endpoint, token, version string) *Client {
	return &Client{
		endpoint: strings.TrimRight(endpoint, "/"),
		token:    token,
		version:  version,
		httpClient: &http.Client{
			Timeout: 35 * time.Second,
		},
	}
}

func (c *Client) Enroll(ctx context.Context, host Host) (Enrollment, error) {
	var enrollment Enrollment
	err := c.doJSON(ctx, http.MethodPost, "/api/agent/enroll", host, &enrollment)
	return enrollment, err
}

func (c *Client) SendHeartbeat(ctx context.Context, heartbeat Heartbeat) (HeartbeatResponse, error) {
	var response HeartbeatResponse
	err := c.doJSON(ctx, http.MethodPost, "/api/agent/heartbeat", heartbeat, &response)
	return response, err
}

func (c *Client) FetchConfig(ctx context.Context) (AgentConfig, error) {
	var cfg AgentConfig
	err := c.doJSON(ctx, http.MethodGet, "/api/agent/config", nil, &cfg)
	return cfg, err
}

func (c *Client) SendResults(ctx context.Context, nodeID string, results []CheckResult) error {
	if len(results) == 0 {
		return nil
	}
	return c.doJSON(ctx, http.MethodPost, "/api/agent/results", resultPayload{
		NodeID:  nodeID,
		Results: results,
	}, nil)
}

func (c *Client) doJSON(ctx context.Context, method, path string, input, output any) error {
	var body []byte
	var err error
	if input != nil {
		body, err = json.Marshal(input)
		if err != nil {
			return fmt.Errorf("encode request: %w", err)
		}
	}

	for attempt := 0; attempt < 3; attempt++ {
		request, requestErr := http.NewRequestWithContext(
			ctx,
			method,
			c.endpoint+path,
			bytes.NewReader(body),
		)
		if requestErr != nil {
			return fmt.Errorf("create request: %w", requestErr)
		}
		request.Header.Set("Authorization", "Bearer "+c.token)
		request.Header.Set("Accept", "application/json")
		request.Header.Set("User-Agent", "zarkiv-agent/"+c.version)
		if input != nil {
			request.Header.Set("Content-Type", "application/json")
		}

		response, requestErr := c.httpClient.Do(request)
		if requestErr != nil {
			if attempt < 2 && waitForRetry(ctx, attempt) {
				continue
			}
			return fmt.Errorf("send request: %w", requestErr)
		}

		data, readErr := io.ReadAll(io.LimitReader(response.Body, 1<<20))
		response.Body.Close()
		if readErr != nil {
			return fmt.Errorf("read response: %w", readErr)
		}
		if response.StatusCode >= 200 && response.StatusCode < 300 {
			if output != nil && len(data) > 0 {
				if err := json.Unmarshal(data, output); err != nil {
					return fmt.Errorf("decode response: %w", err)
				}
			}
			return nil
		}
		if response.StatusCode >= 500 && attempt < 2 && waitForRetry(ctx, attempt) {
			continue
		}
		return &ResponseError{Status: response.StatusCode, Body: string(data)}
	}
	return fmt.Errorf("request retries exhausted")
}

func waitForRetry(ctx context.Context, attempt int) bool {
	timer := time.NewTimer(time.Duration(1<<attempt) * time.Second)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
