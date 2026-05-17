package config

import "os"

type Config struct {
	DBUrl      string
	RedisAddr  string
	RedisPass  string
	KronyxToken string
}

func Load() *Config {
	return &Config{
		DBUrl:     os.Getenv("DATABASE_URL"),
		RedisAddr: os.Getenv("REDIS_ADDR"),
		RedisPass: os.Getenv("REDIS_PASSWORD"),
		KronyxToken: os.Getenv("KRONYX_SECRET"),
	}
}
