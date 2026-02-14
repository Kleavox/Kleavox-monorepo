package main

import (
	"log"
	"os"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

func main() {

	coreURL := os.Getenv("CORE_URL")
	nodeName := os.Getenv("NODE_NAME")
	nodeRole := os.Getenv("NODE_ROLE")
	nodeIP := os.Getenv("NODE_IP")
	secret := os.Getenv("KRONYX_SECRET")

	client := resty.New()

	client.R().
		SetHeader("X-Kronyx-Token", secret).
		SetBody(map[string]string{
			"name": nodeName,
			"ip":   nodeIP,
			"role": nodeRole,
		}).
		Post(coreURL + "/register")

	log.Println("Registered to Kronyx Core")

	for {
		sendHeartbeat(client, coreURL, nodeName, secret)
		sendMetrics(client, coreURL, nodeName, secret)
		time.Sleep(15 * time.Second)
	}
}

func sendHeartbeat(client *resty.Client, coreURL, nodeName, secret string) {
	client.R().
		SetHeader("X-Kronyx-Token", secret).
		SetQueryParam("name", nodeName).
		Post(coreURL + "/heartbeat")
}

func sendMetrics(client *resty.Client, coreURL, nodeName, secret string) {

	cpuPercent, _ := cpu.Percent(0, false)
	memStat, _ := mem.VirtualMemory()
	diskStat, _ := disk.Usage("/")

	client.R().
		SetHeader("X-Kronyx-Token", secret).
		SetBody(map[string]interface{}{
			"node_name":    nodeName,
			"cpu_usage":    cpuPercent[0],
			"memory_usage": memStat.UsedPercent,
			"disk_usage":   diskStat.UsedPercent,
		}).
		Post(coreURL + "/metrics")
}
