package indicators

import (
	"math"
)

// Indicator is the interface for all technical indicators.
type Indicator interface {
	Update(value float64) float64
	Value() float64
}

// SMA (Simple Moving Average)
type SMA struct {
	period int
	values []float64
	sum    float64
}

func NewSMA(period int) *SMA {
	return &SMA{
		period: period,
		values: make([]float64, 0, period),
	}
}

func (s *SMA) Update(value float64) float64 {
	s.sum += value
	s.values = append(s.values, value)
	if len(s.values) > s.period {
		s.sum -= s.values[0]
		s.values = s.values[1:]
	}
	return s.Value()
}

func (s *SMA) Value() float64 {
	if len(s.values) == 0 {
		return 0
	}
	return s.sum / float64(len(s.values))
}

// EMA (Exponential Moving Average)
type EMA struct {
	period     int
	value      float64
	alpha      float64
	initialized bool
}

func NewEMA(period int) *EMA {
	return &EMA{
		period: period,
		alpha:  2.0 / float64(period+1),
	}
}

func (e *EMA) Update(value float64) float64 {
	if !e.initialized {
		e.value = value
		e.initialized = true
	} else {
		e.value = e.alpha*value + (1-e.alpha)*e.value
	}
	return e.value
}

func (e *EMA) Value() float64 {
	return e.value
}

// RSI (Relative Strength Index)
type RSI struct {
	period    int
	lastValue float64
	avgGain   float64
	avgLoss   float64
	count     int
}

func NewRSI(period int) *RSI {
	return &RSI{
		period: period,
	}
}

func (r *RSI) Update(value float64) float64 {
	if r.count == 0 {
		r.lastValue = value
		r.count++
		return 50
	}

	diff := value - r.lastValue
	gain := 0.0
	loss := 0.0
	if diff > 0 {
		gain = diff
	} else {
		loss = -diff
	}

	if r.count <= r.period {
		r.avgGain += gain
		r.avgLoss += loss
		if r.count == r.period {
			r.avgGain /= float64(r.period)
			r.avgLoss /= float64(r.period)
		}
	} else {
		r.avgGain = (r.avgGain*float64(r.period-1) + gain) / float64(r.period)
		r.avgLoss = (r.avgLoss*float64(r.period-1) + loss) / float64(r.period)
	}

	r.lastValue = value
	r.count++

	if r.avgLoss == 0 {
		return 100
	}
	rs := r.avgGain / r.avgLoss
	return 100 - (100 / (1 + rs))
}

func (r *RSI) Value() float64 {
	if r.avgLoss == 0 {
		return 100
	}
	rs := r.avgGain / r.avgLoss
	return 100 - (100 / (1 + rs))
}

// BollingerBands
type BollingerBands struct {
	period int
	stdDev float64
	sma    *SMA
	values []float64
}

func NewBollingerBands(period int, stdDev float64) *BollingerBands {
	return &BollingerBands{
		period: period,
		stdDev: stdDev,
		sma:    NewSMA(period),
		values: make([]float64, 0, period),
	}
}

func (b *BollingerBands) Update(value float64) (mid, upper, lower float64) {
	b.sma.Update(value)
	b.values = append(b.values, value)
	if len(b.values) > b.period {
		b.values = b.values[1:]
	}

	mid = b.sma.Value()
	if len(b.values) < b.period {
		return mid, mid, mid
	}

	var sumSqDiff float64
	for _, v := range b.values {
		diff := v - mid
		sumSqDiff += diff * diff
	}
	std := math.Sqrt(sumSqDiff / float64(b.period))
	upper = mid + b.stdDev*std
	lower = mid - b.stdDev*std
	return mid, upper, lower
}
