// Package producer provides a Redpanda/Kafka message producer.
package producer

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/segmentio/kafka-go"
)

// Producer wraps a Kafka writer for publishing to Redpanda.
type Producer struct {
	writer *kafka.Writer
	topic  string
}

// New creates a new Redpanda producer.
func New(brokers string, topic string) (*Producer, error) {
	brokerList := strings.Split(brokers, ",")

	w := &kafka.Writer{
		Addr:         kafka.TCP(brokerList...),
		Topic:        topic,
		Balancer:     &kafka.RoundRobin{},
		BatchSize:    100,
		BatchTimeout: 10 * time.Millisecond,
		Async:        true,
		RequiredAcks: kafka.RequireOne,
	}

	return &Producer{writer: w, topic: topic}, nil
}

// Publish sends a message to the configured topic.
func (p *Producer) Publish(ctx context.Context, data []byte) error {
	return p.writer.WriteMessages(ctx, kafka.Message{
		Value: data,
		Time:  time.Now(),
	})
}

// PublishKeyed sends a keyed message (for partition affinity by symbol).
func (p *Producer) PublishKeyed(ctx context.Context, key string, data []byte) error {
	return p.writer.WriteMessages(ctx, kafka.Message{
		Key:   []byte(key),
		Value: data,
		Time:  time.Now(),
	})
}

// Close shuts down the producer gracefully.
func (p *Producer) Close() {
	if err := p.writer.Close(); err != nil {
		slog.Error("Failed to close producer", "error", err)
	}
}
