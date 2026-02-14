package database

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPostgresPool(url string) *pgxpool.Pool {
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		log.Fatal("Failed to connect to PostgreSQL:", err)
	}

	err = pool.Ping(context.Background())
	if err != nil {
		log.Fatal("PostgreSQL not reachable:", err)
	}

	return pool
}
