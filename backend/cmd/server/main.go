package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
	_ "time/tzdata" // APP_TIMEZONE works in minimal containers without system zoneinfo

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"

	"money-manager/internal/config"
	"money-manager/internal/database"
	"money-manager/internal/handlers"
	"money-manager/internal/middleware"
	"money-manager/internal/migrations"
	"money-manager/internal/repositories"
	"money-manager/pkg/response"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	if err := database.EnsureDatabase(ctx, cfg); err != nil {
		log.Fatalf("database: %v", err)
	}
	pool, err := database.Connect(ctx, cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()
	if err := migrations.Run(ctx, pool); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	cancel()

	userRepo := repositories.NewUserRepository(pool)
	authH := handlers.NewAuthHandler(userRepo, cfg.JWTSecret, cfg.JWTExpiry, cfg.Timezone)
	categoryH := handlers.NewCategoryHandler(repositories.NewCategoryRepository(pool))
	txH := handlers.NewTransactionHandler(repositories.NewTransactionRepository(pool), cfg.Timezone)
	reportH := handlers.NewReportHandler(repositories.NewReportRepository(pool), userRepo, cfg.Timezone)
	recurringRepo := repositories.NewRecurringRepository(pool)
	recurringH := handlers.NewRecurringHandler(recurringRepo, cfg.Timezone)
	budgetH := handlers.NewBudgetHandler(repositories.NewBudgetRepository(pool), userRepo, cfg.Timezone)
	goalH := handlers.NewGoalHandler(userRepo, repositories.NewGoalRepository(pool), repositories.NewTransactionRepository(pool), recurringRepo, cfg.Timezone)
	favoriteH := handlers.NewFavoriteHandler(repositories.NewFavoriteRepository(pool))

	workerCtx, stopWorker := context.WithCancel(context.Background())
	defer stopWorker()
	go runRecurringWorker(workerCtx, recurringRepo, cfg.Timezone)

	app := fiber.New(fiber.Config{
		AppName: "Money Manager API",
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if e, ok := err.(*fiber.Error); ok {
				code = e.Code
			}
			return response.Error(c, code, err.Error())
		},
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		if err := pool.Ping(c.Context()); err != nil {
			return response.Error(c, fiber.StatusServiceUnavailable, "database unavailable")
		}
		return response.Message(c, "ok")
	})

	api := app.Group("/api/v1")

	auth := api.Group("/auth")
	auth.Post("/register", authH.Register)
	auth.Post("/login", authH.Login)

	protected := api.Group("", middleware.JWTAuth(cfg.JWTSecret))

	protected.Get("/me", authH.Me)
	protected.Put("/me", authH.UpdateProfile)
	protected.Put("/me/password", authH.ChangePassword)

	protected.Get("/categories", categoryH.List)
	protected.Post("/categories", categoryH.Create)
	protected.Get("/categories/:id", categoryH.Get)
	protected.Put("/categories/:id", categoryH.Update)
	protected.Delete("/categories/:id", categoryH.Delete)

	protected.Get("/transactions", txH.List)
	protected.Post("/transactions", txH.Create)
	protected.Post("/expenses", txH.CreateExpenses)
	protected.Get("/transactions/:id", txH.Get)
	protected.Put("/transactions/:id", txH.Update)
	protected.Delete("/transactions/:id", txH.Delete)

	protected.Get("/reports/summary", reportH.Summary)
	protected.Get("/reports/by-category", reportH.ByCategory)
	protected.Get("/reports/trend", reportH.Trend)
	protected.Get("/reports/budget", reportH.Budget)
	protected.Get("/reports/frequent-amounts", reportH.FrequentAmounts)

	protected.Get("/recurring", recurringH.List)
	protected.Post("/recurring", recurringH.Create)
	protected.Get("/recurring/:id", recurringH.Get)
	protected.Put("/recurring/:id", recurringH.Update)
	protected.Delete("/recurring/:id", recurringH.Delete)

	protected.Get("/budgets", budgetH.List)
	protected.Put("/budgets", budgetH.Upsert)
	protected.Post("/budgets/copy", budgetH.Copy)
	protected.Delete("/budgets/:id", budgetH.Delete)

	protected.Get("/goals", goalH.List)
	protected.Post("/goals", goalH.Create)
	protected.Put("/goals/:id", goalH.Update)
	protected.Delete("/goals/:id", goalH.Delete)
	protected.Post("/goals/:id/deposits", goalH.Deposit)

	protected.Get("/favorites", favoriteH.List)
	protected.Post("/favorites", favoriteH.Create)
	protected.Delete("/favorites/:id", favoriteH.Delete)

	go func() {
		if err := app.Listen(":" + cfg.AppPort); err != nil {
			log.Fatalf("server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")
	_ = app.ShutdownWithTimeout(10 * time.Second)
}

// runRecurringWorker generates due recurring transactions at startup and then every hour.
func runRecurringWorker(ctx context.Context, repo *repositories.RecurringRepository, loc *time.Location) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		n, err := repo.GenerateDue(ctx, time.Now().In(loc))
		if err != nil {
			log.Printf("recurring worker: %v", err)
		} else if n > 0 {
			log.Printf("recurring worker: created %d transactions", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
