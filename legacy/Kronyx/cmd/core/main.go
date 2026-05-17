package main

import (
	"kronyx/internal/config"
	"kronyx/internal/database"
	"kronyx/internal/handler"
	"kronyx/internal/redisclient"

	"github.com/gin-gonic/gin"
)

func main() {

	cfg := config.Load()

	db := database.NewPostgresPool(cfg.DBUrl)
	rdb := redisclient.NewRedis(cfg.RedisAddr, cfg.RedisPass)

	r := gin.Default()

	r.GET("/health", handler.Health(db, rdb))

	authGroup := r.Group("/")
	authGroup.Use(handler.AuthMiddleware(cfg.KronyxToken))
	{
		authGroup.POST("/register", handler.RegisterNode(db))
		authGroup.POST("/heartbeat", handler.Heartbeat(db))
		authGroup.POST("/metrics", handler.ReceiveMetrics(db))
	}

	r.Run(":8080")
}
