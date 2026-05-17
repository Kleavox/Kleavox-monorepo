package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func Health(db *pgxpool.Pool, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {

		if err := db.Ping(c); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "db down",
			})
			return
		}

		if err := rdb.Ping(c).Err(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "redis down",
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "kronyx healthy",
		})
	}
}
