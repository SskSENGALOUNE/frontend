package handlers

import (
	"testing"
	"time"
)

func TestPreviousRange(t *testing.T) {
	cases := []struct{ from, to, wantFrom, wantTo string }{
		// whole months -> previous calendar month(s)
		{"2026-10-01", "2026-10-31", "2026-09-01", "2026-09-30"},
		{"2026-03-01", "2026-03-31", "2026-02-01", "2026-02-28"},
		{"2028-03-01", "2028-03-31", "2028-02-01", "2028-02-29"},
		{"2026-01-01", "2026-01-31", "2025-12-01", "2025-12-31"},
		{"2026-02-01", "2026-02-28", "2026-01-01", "2026-01-31"},
		{"2026-01-01", "2026-03-31", "2025-10-01", "2025-12-31"},
		{"2026-01-01", "2026-12-31", "2025-01-01", "2025-12-31"},
		// pay periods (25th .. 24th) -> previous pay period(s)
		{"2026-10-25", "2026-11-24", "2026-09-25", "2026-10-24"},
		{"2026-02-25", "2026-03-24", "2026-01-25", "2026-02-24"},
		{"2026-12-25", "2027-01-24", "2026-11-25", "2026-12-24"},
		// other ranges -> same number of days before
		{"2026-10-05", "2026-10-11", "2026-09-28", "2026-10-04"},
		{"2026-10-01", "2026-10-15", "2026-09-16", "2026-09-30"},
		{"2026-10-07", "2026-10-07", "2026-10-06", "2026-10-06"},
	}
	for _, c := range cases {
		gotFrom, gotTo := previousRange(c.from, c.to)
		if gotFrom != c.wantFrom || gotTo != c.wantTo {
			t.Errorf("previousRange(%s, %s) = %s..%s, want %s..%s", c.from, c.to, gotFrom, gotTo, c.wantFrom, c.wantTo)
		}
	}
}

func TestPeriodRange(t *testing.T) {
	cases := []struct{ month, wantFrom, wantTo string }{
		{"2026-11-01", "2026-10-25", "2026-11-24"},
		{"2026-03-01", "2026-02-25", "2026-03-24"},
		{"2027-01-01", "2026-12-25", "2027-01-24"},
	}
	for _, c := range cases {
		if f, to := periodRange(c.month); f != c.wantFrom || to != c.wantTo {
			t.Errorf("periodRange(%s) = %s..%s, want %s..%s", c.month, f, to, c.wantFrom, c.wantTo)
		}
	}
}

func TestNextPayday(t *testing.T) {
	cases := []struct{ now, want string }{
		{"2026-11-10", "2026-11-25"},
		{"2026-11-25", "2026-11-25"},
		{"2026-11-26", "2026-12-25"},
		{"2026-12-31", "2027-01-25"},
	}
	for _, c := range cases {
		now, _ := time.Parse(dateLayout, c.now)
		if got := nextPayday(now); got != c.want {
			t.Errorf("nextPayday(%s) = %s, want %s", c.now, got, c.want)
		}
	}
}
