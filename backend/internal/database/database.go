package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"money-manager/internal/config"
)

// EnsureDatabase creates the target database if it does not exist yet.
func EnsureDatabase(ctx context.Context, cfg *config.Config) error {
	conn, err := pgx.Connect(ctx, cfg.DSN("postgres"))
	if err != nil {
		return fmt.Errorf("connect to maintenance db: %w", err)
	}
	defer conn.Close(ctx)

	var exists bool
	if err := conn.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)`, cfg.DBName,
	).Scan(&exists); err != nil {
		return fmt.Errorf("check database: %w", err)
	}
	if exists {
		return nil
	}

	if _, err := conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{cfg.DBName}.Sanitize()); err != nil {
		return fmt.Errorf("create database: %w", err)
	}
	log.Printf("created database %q", cfg.DBName)
	return nil
}

func Connect(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN(cfg.DBName))
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	poolCfg.MaxConns = 10
	poolCfg.MaxConnIdleTime = 5 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}
