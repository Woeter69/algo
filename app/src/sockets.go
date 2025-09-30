package main

import (
	"strconv"
)

// ============= WHAT IS GO? =============
// Go is a programming language by Google that's:
// - FAST: Compiled, not interpreted like Python
// - CONCURRENT: Can handle thousands of connections at once
// - SIMPLE: Easy to learn and read
// - EFFICIENT: Uses less memory and CPU than Python
// 
// Perfect for real-time chat because:
// - WebSockets are built-in and super fast
// - Can handle 10,000+ concurrent users easily
// - Much faster message broadcasting than Socket.IO
// =====================================

// All main types, structs, and functions are defined in main.go
// This file contains only helper functions that support the main WebSocket server

// WebSocket upgrader and hub variables are defined in main.go

// Helper function to convert interface{} to int for channel IDs
func convertToInt(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case float64:
		return int(v)
	case string:
		if id, err := strconv.Atoi(v); err == nil {
			return id
		}
	}
	return 0 // Default fallback
}
