// Package consumer provides a Redpanda/Kafka message consumer.
package consumer

import (
	"context"
	"log/slog"
	"strings"

	"github.com/segmentio/kafka-go"
)

// Consumer reads messages from a Redpanda topic.
type Consumer struct {
	reader *kafka.Reader
}

// New creates a new consumer for the given topic and consumer group.
func New(brokers, topic, groupID string) (*Consumer, error) {
	brokerList := strings.Split(brokers, ",")

	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokerList,
		Topic:    topic,
		GroupID:  groupID,
		MinBytes: 1,
		MaxBytes: 10e6,
	})

	return &Consumer{reader: r}, nil
}

// Consume reads messages in a loop and calls the handler for each one.
func (c *Consumer) Consume(ctx context.Context, handler func([]byte)) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		msg, err := c.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Error("Failed to read message", "error", err)
			continue
		}

		handler(msg.Value)
	}
}

// Close shuts down the consumer.
func (c *Consumer) Close() {
	if err := c.reader.Close(); err != nil {
		slog.Error("Failed to close consumer", "error", err)
	}
}
