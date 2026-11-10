package repositories

import (
	"testing"
	"time"
)

func TestOccurrence(t *testing.T) {
	d := func(s string) time.Time {
		v, _ := time.Parse(dateLayout, s)
		return v
	}
	cases := []struct {
		start, freq string
		n           int
		want        string
	}{
		{"2026-01-31", "monthly", 0, "2026-01-31"},
		{"2026-01-31", "monthly", 1, "2026-02-28"},
		{"2026-01-31", "monthly", 2, "2026-03-31"},
		{"2026-01-31", "monthly", 3, "2026-04-30"},
		{"2027-12-15", "monthly", 1, "2028-01-15"},
		{"2028-02-29", "yearly", 1, "2029-02-28"},
		{"2028-02-29", "yearly", 4, "2032-02-29"},
		{"2026-10-05", "weekly", 2, "2026-10-19"},
		{"2026-10-30", "daily", 3, "2026-11-02"},
	}
	for _, c := range cases {
		got := Occurrence(d(c.start), c.freq, c.n).Format(dateLayout)
		if got != c.want {
			t.Errorf("Occurrence(%s, %s, %d) = %s, want %s", c.start, c.freq, c.n, got, c.want)
		}
	}
}

func TestResumeIndex(t *testing.T) {
	d := func(s string) time.Time {
		v, _ := time.Parse(dateLayout, s)
		return v
	}
	cases := []struct {
		name, start, freq string
		runCount          int
		today, wantNext   string
	}{
		// paused after Aug 25 was generated (run_count 1), resumed Oct 5: skip Sep 25, next is Oct 25
		{"skip missed monthly", "2026-08-25", "monthly", 1, "2026-10-05", "2026-10-25"},
		// resumed on the due day itself: today's occurrence is kept
		{"due today kept", "2026-08-25", "monthly", 1, "2026-10-25", "2026-10-25"},
		// nothing missed: run_count unchanged
		{"nothing missed", "2026-10-01", "monthly", 1, "2026-10-20", "2026-11-01"},
		{"daily", "2026-10-01", "daily", 2, "2026-10-10", "2026-10-10"},
		{"weekly", "2026-10-01", "weekly", 1, "2026-10-20", "2026-10-22"},
		// start date still in the future
		{"not started", "2026-12-01", "monthly", 0, "2026-10-05", "2026-12-01"},
	}
	for _, c := range cases {
		n := ResumeIndex(d(c.start), c.freq, c.runCount, d(c.today))
		if n < c.runCount {
			t.Errorf("%s: index %d went below run_count %d", c.name, n, c.runCount)
		}
		if got := Occurrence(d(c.start), c.freq, n).Format(dateLayout); got != c.wantNext {
			t.Errorf("%s: next = %s, want %s", c.name, got, c.wantNext)
		}
	}
}
