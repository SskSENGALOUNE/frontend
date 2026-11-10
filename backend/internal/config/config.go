package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort     string
	CORSOrigins string
	Timezone    *time.Location

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret string
	JWTExpiry time.Duration
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	expiryHours, err := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "72"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_EXPIRY_HOURS: %w", err)
	}

	tz, err := time.LoadLocation(getEnv("APP_TIMEZONE", "Asia/Vientiane"))
	if err != nil {
		return nil, fmt.Errorf("invalid APP_TIMEZONE: %w", err)
	}

	cfg := &Config{
		Timezone:    tz,
		AppPort:     getEnv("APP_PORT", "8080"),
		CORSOrigins: getEnv("CORS_ORIGINS", "*"),
		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBUser:      getEnv("DB_USER", "postgres"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBName:      getEnv("DB_NAME", "money_manager"),
		DBSSLMode:   getEnv("DB_SSLMODE", "disable"),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		JWTExpiry:   time.Duration(expiryHours) * time.Hour,
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	return cfg, nil
}

// DSN builds a connection string for the given database name.
func (c *Config) DSN(dbName string) string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.DBUser, c.DBPassword),
		Host:     net.JoinHostPort(c.DBHost, c.DBPort),
		Path:     "/" + dbName,
		RawQuery: "sslmode=" + url.QueryEscape(c.DBSSLMode),
	}
	return u.String()
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
