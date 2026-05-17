package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MetricsRequest struct {
	NodeName string  `json:"node_name"`
	CPU      float64 `json:"cpu_usage"`
	Memory   float64 `json:"memory_usage"`
	Disk     float64 `json:"disk_usage"`
}

func ReceiveMetrics(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {

		var req MetricsRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}

		_, err := db.Exec(
			c.Request.Context(),
			`INSERT INTO metrics (node_name, cpu_usage, memory_usage, disk_usage)
			 VALUES ($1, $2, $3, $4)`,
			req.NodeName,
			req.CPU,
			req.Memory,
			req.Disk,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "metrics stored"})
	}
}
