package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RegisterRequest struct {
	Name string `json:"name"`
	IP   string `json:"ip"`
	Role string `json:"role"`
}

func RegisterNode(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {

		var req RegisterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid request",
			})
			return
		}

		_, err := db.Exec(
			c.Request.Context(),
			`INSERT INTO nodes (name, ip, role, last_seen)
			 VALUES ($1, $2, $3, NOW())
			 ON CONFLICT (name)
			 DO UPDATE SET
			   ip = EXCLUDED.ip,
			   role = EXCLUDED.role,
			   last_seen = NOW()`,
			req.Name,
			req.IP,
			req.Role,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "registered",
		})
	}
}

func Heartbeat(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {

		name := c.Query("name")
		if name == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "missing node name",
			})
			return
		}

		_, err := db.Exec(
			c.Request.Context(),
			"UPDATE nodes SET last_seen=$1 WHERE name=$2",
			time.Now(),
			name,
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "alive",
		})
	}
}
