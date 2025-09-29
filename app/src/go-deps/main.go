package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
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

// Message types - handles both channels and direct chat
type MessageType string

const (
	// Channel events (for /channels)
	JoinChannel        MessageType = "join_channel"
	LeaveChannel       MessageType = "leave_channel"
	SendChannelMessage MessageType = "send_channel_message"
	GetChannelMessages MessageType = "get_channel_messages"
	ChannelHistory     MessageType = "messages_history"

	// Message events (for both /channels and /chat)
	SendMessage MessageType = "send_message"
	NewMessage  MessageType = "new_message"

	// Direct chat events (for /chat/<username>)
	JoinChatRoom   MessageType = "join_chat_room"
	LeaveChatRoom  MessageType = "leave_chat_room"
	ChatMessage    MessageType = "chat_message"
	NewChatMessage MessageType = "new_chat_message"

	// Typing events (for both)
	TypingStart MessageType = "typing_start"
	TypingStop  MessageType = "typing_stop"
	UserTyping  MessageType = "user_typing"

	// User status events
	UserJoined  MessageType = "user_joined"
	UserLeft    MessageType = "user_left"
	UserOnline  MessageType = "user_online"
	UserOffline MessageType = "user_offline"
)

// WebSocket message structure - handles both channels and direct chat
type WSMessage struct {
	Type       MessageType `json:"type"`
	ChannelID  interface{} `json:"channel_id,omitempty"`  // For /channels (can be string or int)
	ChatRoom   string      `json:"chat_room,omitempty"`   // For /chat (e.g., "user_1_user_2")
	SenderID   int         `json:"sender_id,omitempty"`   // For direct chat
	ReceiverID int         `json:"receiver_id,omitempty"` // For direct chat
	UserID     int         `json:"user_id"`
	Username   string      `json:"username"`
	Content    string      `json:"content,omitempty"`
	MessageID  string      `json:"message_id,omitempty"`
	CreatedAt  string      `json:"created_at,omitempty"`
	PfpPath    string      `json:"pfp_path,omitempty"`
	Data       interface{} `json:"data,omitempty"`
	Timestamp  time.Time   `json:"timestamp"`
}

// Client represents a connected user
type Client struct {
	ID        string
	UserID    int
	Username  string
	PfpPath   string
	Conn      *websocket.Conn
	Channels  map[int]bool    // which channels user is in (/channels)
	ChatRooms map[string]bool // which chat rooms user is in (/chat)
	Send      chan WSMessage
	Hub       *Hub
}

// Hub manages all connected clients - handles both channels and direct chat
type Hub struct {
	// All connected clients by user ID
	Clients map[int]*Client

	// Channel rooms: channel_id -> map of clients in that channel (/channels)
	Channels map[int]map[int]*Client

	// Typing users in chat rooms: room_name -> set of user IDs typing
	ChatTyping map[string]map[int]bool

	// Channel typing: channel_id -> set of user IDs typing
	ChannelTyping map[int]map[int]bool

	// Chat rooms: room_name -> map of clients in that room (/chat)
	ChatRooms map[string]map[int]*Client

	// Communication channels
	Broadcast  chan WSMessage
	Register   chan *Client
	Unregister chan *Client

	// Database connection
	DB *sql.DB

	// Thread safety
	Mutex sync.RWMutex
}

// WebSocket upgrader - converts HTTP to WebSocket
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

var (
	db  *sql.DB
	hub *Hub
)

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Helper function to convert channel_id from interface{} to int
func getChannelID(channelID interface{}) int {
	switch v := channelID.(type) {
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

// Create new Hub - handles both channels and direct chat
func NewHub(db *sql.DB) *Hub {
	return &Hub{
		Clients:       make(map[int]*Client),
		Channels:      make(map[int]map[int]*Client),
		ChatRooms:     make(map[string]map[int]*Client),
		ChannelTyping: make(map[int]map[int]bool),
		ChatTyping:    make(map[string]map[int]bool),
		Register:      make(chan *Client),
		Unregister:    make(chan *Client),
		Broadcast:     make(chan WSMessage, 100), // Buffered channel to prevent blocking
		DB:            db,
	}
}

// Main Hub loop - handles all WebSocket events
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			// User connected
			h.Mutex.Lock()
			h.Clients[client.UserID] = client
			h.Mutex.Unlock()

			log.Printf("✅ User %s (ID: %d) connected", client.Username, client.UserID)

			// Tell everyone this user came online
			h.broadcastUserStatus(client.UserID, client.Username, true)

		case client := <-h.Unregister:
			// User disconnected
			h.Mutex.Lock()
			if _, ok := h.Clients[client.UserID]; ok {
				// Remove from all channels
				for channelID := range client.Channels {
					h.removeFromChannel(client.UserID, channelID)
				}

				delete(h.Clients, client.UserID)
				close(client.Send)
			}
			h.Mutex.Unlock()

			log.Printf("❌ User %s (ID: %d) disconnected", client.Username, client.UserID)

			// Tell everyone this user went offline
			h.broadcastUserStatus(client.UserID, client.Username, false)

		case message := <-h.Broadcast:
			// Broadcast message to all users
			log.Printf("🎯 Hub received broadcast message: type='%s' from user %s", message.Type, message.Username)
			h.handleBroadcast(message)
		}
	}
}

// Handle different types of messages
func (h *Hub) handleBroadcast(message WSMessage) {
	log.Printf("🔍 Processing message type: %s from user %s", message.Type, message.Username)
	switch message.Type {
	// Channel messages
	case NewMessage:
		h.broadcastToChannel(message)
	case JoinChannel:
		h.handleJoinChannel(message)
	case LeaveChannel:
		h.handleLeaveChannel(message)
	case GetChannelMessages:
		h.handleGetChannelMessages(message)
	case SendChannelMessage:
		h.handleSendChannelMessage(message)
	case UserTyping:
		h.handleChannelTyping(message)
	// Direct chat messages (for /chat/<username>)
	case SendMessage:
		h.handleChatMessage(message)
	case ChatMessage:
		h.handleChatMessage(message)
	case "typing_start":
		h.handleDirectTyping(message, true)
	case "typing_stop":
		h.handleDirectTyping(message, false)
	case "join_chat_room":
		h.handleJoinChatRoom(message)
	default:
		log.Printf("🔍 Unknown message type: %s", message.Type)
	}
}

// Broadcast message to all clients in a channel
func (h *Hub) broadcastToChannel(message WSMessage) {
	log.Printf("🔍 broadcastToChannel called - acquiring lock...")

	// Use timeout for the entire function to prevent hanging
	done := make(chan bool, 1)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("❌ Panic in broadcastToChannel: %v", r)
			}
			done <- true
		}()

		h.Mutex.RLock()
		defer h.Mutex.RUnlock()

		channelID := getChannelID(message.ChannelID)
		log.Printf("🔍 Broadcasting to channel %d, sender userID: %d", channelID, message.UserID)

		if channelClients, exists := h.Channels[channelID]; exists {
			log.Printf("📋 Channel %d has %d clients", channelID, len(channelClients))
			for userID, client := range channelClients {
				log.Printf("🎯 Checking client %d (sender: %d)", userID, message.UserID)

				// Check if client is nil
				if client == nil {
					log.Printf("❌ Client %d is nil, cleaning up", userID)
					delete(channelClients, userID)
					continue
				}

				// Don't send back to sender
				if userID != message.UserID {
					log.Printf("📤 Sending message to client %d", userID)
					// Use non-blocking send
					select {
					case client.Send <- message:
						log.Printf("✅ Message sent to client %d", userID)
					default:
						log.Printf("❌ Client %d channel full, cleaning up", userID)
						// Client channel is full, clean up
						if client.Send != nil {
							close(client.Send)
						}
						delete(channelClients, userID)
					}
				} else {
					log.Printf("⏭️ Skipping sender %d", userID)
				}
			}
		} else {
			log.Printf("❌ Channel %d not found in channels map", channelID)
		}
		log.Printf("✅ Broadcast to channel %d complete", channelID)
	}()

	// Wait for completion or timeout
	select {
	case <-done:
		log.Printf("✅ broadcastToChannel completed normally")
	case <-time.After(2 * time.Second):
		log.Printf("⏰ broadcastToChannel timed out after 2 seconds")
	}
}

// Fast broadcast for typing indicators (no timeouts, no complex logic)
func (h *Hub) fastBroadcastToChannel(message WSMessage) {
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()

	channelID := getChannelID(message.ChannelID)
	log.Printf("⚡ Fast broadcasting typing to channel %d from user %d", channelID, message.UserID)
	
	if channelClients, exists := h.Channels[channelID]; exists {
		for userID, client := range channelClients {
			// Don't send back to sender
			if userID != message.UserID && client != nil {
				// Non-blocking send
				select {
				case client.Send <- message:
					log.Printf("⚡ Typing sent to client %d", userID)
				default:
					// Skip if channel is full, don't clean up for typing
				}
			}
		}
	}
}

// Handle user joining a channel
func (h *Hub) handleJoinChannel(message WSMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	// Get channel ID
	channelID := getChannelID(message.ChannelID)
	log.Printf("🔍 User %d (%s) attempting to join channel %d", message.UserID, message.Username, channelID)

	// Add client to channel
	if channelID > 0 {
		if h.Channels[channelID] == nil {
			h.Channels[channelID] = make(map[int]*Client)
		}
		h.Channels[channelID][message.UserID] = h.Clients[message.UserID]

		log.Printf("👥 User %s joined channel %d", message.Username, channelID)

		// Notify others in channel
		notification := WSMessage{
			Type:      UserJoined,
			ChannelID: message.ChannelID,
			UserID:    message.UserID,
			Username:  message.Username,
			Timestamp: time.Now(),
		}
		h.broadcastToChannel(notification)
	}
}

// Handle user leaving a channel
func (h *Hub) handleLeaveChannel(message WSMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	channelID := getChannelID(message.ChannelID)
	h.removeFromChannel(message.UserID, channelID)

	// Notify others in channel
	notification := WSMessage{
		Type:      UserLeft,
		ChannelID: message.ChannelID,
		UserID:    message.UserID,
		Username:  message.Username,
		Timestamp: time.Now(),
	}
	h.broadcastToChannel(notification)
}

// Remove user from channel
func (h *Hub) removeFromChannel(userID, channelID int) {
	if channelClients, exists := h.Channels[channelID]; exists {
		delete(channelClients, userID)
		if len(channelClients) == 0 {
			delete(h.Channels, channelID)
		}
	}

	if client, exists := h.Clients[userID]; exists {
		delete(client.Channels, channelID)
	}

	// Remove from typing users
	if typingUsers, exists := h.ChannelTyping[channelID]; exists {
		delete(typingUsers, userID)
	}
}

// Handle typing indicators
func (h *Hub) handleTyping(message WSMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()

	channelID := getChannelID(message.ChannelID)
	if h.ChannelTyping[channelID] == nil {
		h.ChannelTyping[channelID] = make(map[int]bool)
	}

	// Update typing status
	if data, ok := message.Data.(map[string]interface{}); ok {
		if typing, exists := data["typing"].(bool); exists {
			if typing {
				h.ChannelTyping[channelID][message.UserID] = true
			} else {
				delete(h.ChannelTyping[channelID], message.UserID)
			}
		}
	}

	// Broadcast typing status
	h.broadcastToChannel(message)
}

// Handle direct chat messages
func (h *Hub) handleChatMessage(message WSMessage) {
	log.Printf("📨 Handling chat message from %s: %s", message.Username, message.Type)

	// Save message to database
	if h.DB != nil {
		h.saveChatMessage(message)
	}

	// Create response message
	response := WSMessage{
		Type:       NewChatMessage,
		UserID:     message.UserID,
		Username:   message.Username,
		Content:    message.Content,
		ReceiverID: message.ReceiverID,
		PfpPath:    message.PfpPath,
		Timestamp:  message.Timestamp,
	}

	// Send to receiver if online
	if receiverClient, exists := h.Clients[message.ReceiverID]; exists {
		select {
		case receiverClient.Send <- response:
			log.Printf("✅ Message delivered to receiver %d", message.ReceiverID)
		default:
			log.Printf("❌ Failed to deliver message to receiver %d", message.ReceiverID)
		}
	} else {
		log.Printf("📴 Receiver %d is offline, message saved for later", message.ReceiverID)
	}

	// Also send back to sender for real-time feedback
	if senderClient, exists := h.Clients[message.UserID]; exists {
		select {
		case senderClient.Send <- response:
			log.Printf("✅ Message echoed back to sender %d", message.UserID)
		default:
			log.Printf("❌ Failed to echo message back to sender %d", message.UserID)
		}
	}
}

// Handle direct chat typing indicators
func (h *Hub) handleDirectTyping(message WSMessage, isTyping bool) {
	if receiverClient, exists := h.Clients[message.ReceiverID]; exists {
		typingType := "typing_start"
		if !isTyping {
			typingType = "typing_stop"
		}

		response := WSMessage{
			Type:       MessageType(typingType),
			UserID:     message.UserID,
			Username:   message.Username,
			ReceiverID: message.ReceiverID,
			Timestamp:  message.Timestamp,
		}

		select {
		case receiverClient.Send <- response:
			log.Printf("👀 Typing indicator sent to user %d", message.ReceiverID)
		default:
			log.Printf("❌ Failed to send typing indicator to user %d", message.ReceiverID)
		}
	}
}

// Handle joining chat rooms
func (h *Hub) handleJoinChatRoom(message WSMessage) {
	log.Printf("🚪 User %s joining chat room", message.Username)
	// Chat rooms are handled implicitly through direct messaging
	// No specific room management needed for 1-on-1 chats
}

// Save chat message to database
func (h *Hub) saveChatMessage(message WSMessage) {
	if h.DB == nil {
		log.Printf("⚠️ No database connection, message not saved")
		return
	}

	query := `
		INSERT INTO messages (sender_id, receiver_id, content, created_at)
		VALUES ($1, $2, $3, $4)
	`

	_, err := h.DB.Exec(query, message.UserID, message.ReceiverID, message.Content, message.Timestamp)
	if err != nil {
		log.Printf("❌ Failed to save message to database: %v", err)
		log.Printf("🔍 Query: %s", query)
		log.Printf("🔍 Values: sender_id=%d, receiver_id=%d, content=%s", message.UserID, message.ReceiverID, message.Content)
	} else {
		log.Printf("✅ Message saved to database: %s -> %d", message.Username, message.ReceiverID)
	}
}

// Broadcast user online/offline status
func (h *Hub) broadcastUserStatus(userID int, username string, online bool) {
	messageType := UserOnline
	if !online {
		messageType = UserOffline
	}

	message := WSMessage{
		Type:      messageType,
		UserID:    userID,
		Username:  username,
		Timestamp: time.Now(),
	}

	// Broadcast to all connected clients
	h.Mutex.RLock()
	for _, client := range h.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(h.Clients, client.UserID)
		}
	}
	h.Mutex.RUnlock()
}

// Verify if user has access to channel (check community membership)
func (h *Hub) verifyChannelAccess(userID, channelID int) bool {
	query := `
		SELECT 1 FROM channels c
		JOIN communities comm ON c.community_id = comm.community_id
		JOIN community_members cm ON comm.community_id = cm.community_id
		WHERE c.channel_id = $1 AND cm.user_id = $2 AND cm.status = 'active'
	`

	var exists int
	err := h.DB.QueryRow(query, channelID, userID).Scan(&exists)
	return err == nil
}

// Handle individual client connection
func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("❌ WebSocket upgrade failed: %v", err)
		return
	}

	// Get user info from query parameters (you'll pass this from frontend)
	userIDStr := r.URL.Query().Get("user_id")
	username := r.URL.Query().Get("username")
	pfpPath := r.URL.Query().Get("pfp_path")

	if userIDStr == "" || username == "" {
		log.Printf("❌ Missing user credentials")
		conn.Close()
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		log.Printf("❌ Invalid user ID: %s", userIDStr)
		conn.Close()
		return
	}

	// Create new client
	client := &Client{
		ID:        fmt.Sprintf("%d_%d", userID, time.Now().Unix()),
		UserID:    userID,
		Username:  username,
		PfpPath:   pfpPath,
		Conn:      conn,
		Channels:  make(map[int]bool),
		ChatRooms: make(map[string]bool),
		Send:      make(chan WSMessage, 256),
		Hub:       h,
	}

	// Register client
	h.Register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// Read messages from WebSocket
func (c *Client) readPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	// Set read deadline and pong handler
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		// Read message from WebSocket
		_, messageBytes, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("❌ WebSocket error: %v", err)
			}
			break
		}

		// Parse JSON message
		var message WSMessage
		if err := json.Unmarshal(messageBytes, &message); err != nil {
			log.Printf("❌ Invalid JSON: %v", err)
			continue
		}

		// Set user info
		message.UserID = c.UserID
		message.Username = c.Username
		message.Timestamp = time.Now()

		log.Printf("📨 Received message from %s: type='%s' (len=%d)", c.Username, message.Type, len(string(message.Type)))

		// Handle channel messages directly, others through broadcast
		if message.Type == "get_channel_messages" {
			log.Printf("🧪 DIRECT CHANNEL: Calling handleGetChannelMessages directly")
			c.Hub.handleGetChannelMessages(message)
		} else {
			// Handle all other messages through broadcast channel
			log.Printf("🚀 Sending to broadcast channel: %s", message.Type)
			select {
			case c.Hub.Broadcast <- message:
				log.Printf("✅ Sent to broadcast channel: %s", message.Type)
			default:
				log.Printf("⚠️ Broadcast channel full, dropping message: %s", message.Type)
			}
		}
	}
}

// Write messages to WebSocket
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Send JSON message
			if err := c.Conn.WriteJSON(message); err != nil {
				log.Printf("❌ Write error: %v", err)
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Database connection
func connectDB() *sql.DB {
	// Get database URL from environment variable (Render sets this automatically)
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		// Fallback to your existing connection string for local development
		connStr = "postgresql://algo_database_user:XyB825sj3CoiUZpEsDyYz4zASy16Gg1o@dpg-d32qu6juibrs73a3u200-a.oregon-postgres.render.com/algo_database"
	}

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}

	if err := db.Ping(); err != nil {
		log.Fatal("❌ Database ping failed:", err)
	}

	log.Println("✅ Connected to PostgreSQL database")
	return db
}

// CORS middleware
func enableCORS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}
}

// Health check endpoint
func healthCheck(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "go-websocket-server",
		"time":    time.Now().Format(time.RFC3339),
	})
}

func main() {
	log.Println("🚀 Starting Go WebSocket server...")

	// Get port from environment variable (Render sets this)
	portStr := os.Getenv("PORT")
	if portStr == "" {
		portStr = "8080" // Default for local development
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatal("❌ Invalid port number:", err)
	}
	log.Printf("📡 Port: %d", port)

	// Get database URL
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL != "" {
		log.Printf("🗄️  Database URL: %s", dbURL[:20]+"...") // Log first 20 chars only for security
	}

	// Connect to database
	db = connectDB()
	if db != nil {
		defer db.Close()

		// Test database connection
		if err := db.Ping(); err != nil {
			log.Printf("⚠️  Database connection failed: %v", err)
			log.Println("🔄 Continuing without database (WebSocket will still work)")
		} else {
			log.Println("✅ Database connected successfully!")
		}
	} else {
		log.Println("⚠️  No database connection (WebSocket will still work)")
	}

	// Initialize Hub
	hub = NewHub(db)
	go hub.Run()

	// Initialize OAuth handler
	oauth := NewGoogleOAuth(db)
	if oauth != nil {
		oauth.setupOAuthRoutes()
	}

	// Initialize WebSocket upgrader
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Allow all origins in production (you might want to restrict this)
			return true
		},
	}

	// WebSocket endpoint
	http.HandleFunc("/ws", hub.handleWebSocket)

	// Health check endpoint with CORS
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Println("🏥 Health check requested")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Go WebSocket Server OK"))
	})

	// Simple test endpoint with CORS
	http.HandleFunc("/test", func(w http.ResponseWriter, r *http.Request) {
		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		log.Println("🧪 Test endpoint requested")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Go server is running!"))
	})

	// Server configuration
	host := "0.0.0.0"

	// Start WebSocket server
	log.Printf("🚀 WebSocket server starting on port %d", port)
	log.Printf("🌐 Binding to: %s:%d (all interfaces)", host, port)
	log.Printf("🌐 WebSocket endpoint: ws://%s:%d/ws", "localhost", port)
	log.Printf("🌐 WebSocket endpoint: ws://%s:%d/ws", "127.0.0.1", port)
	log.Printf("🌐 WebSocket endpoint: ws://%s:%d/ws", "192.168.56.131", port)
	log.Printf("❤️  Health check: http://%s:%d/health", "localhost", port)
	log.Printf("❤️  Health check: http://%s:%d/health", "127.0.0.1", port)
	log.Printf("🧪 Test endpoint: http://%s:%d/test", "localhost", port)
	log.Printf("📡 Broadcast API: http://%s:%d/api/broadcast", "localhost", port)

	// Broadcast API endpoint for Python to trigger WebSocket broadcasts
	http.HandleFunc("/api/broadcast", func(w http.ResponseWriter, r *http.Request) {
		handleBroadcastAPI(hub, w, r)
	})

	// Start the server
	log.Fatal(http.ListenAndServe(fmt.Sprintf("%s:%d", host, port), nil))
}

// Handle broadcast API requests from Python
func handleBroadcastAPI(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	// Parse the broadcast request
	var broadcastReq struct {
		Type      string      `json:"type"`
		ChannelID interface{} `json:"channel_id"`
		Message   interface{} `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&broadcastReq); err != nil {
		log.Printf("❌ Failed to decode broadcast request: %v", err)
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	log.Printf("📡 Received broadcast request: type=%s, channel_id=%v", broadcastReq.Type, broadcastReq.ChannelID)

	// Extract user info from the message data
	var userID int
	if msgData, ok := broadcastReq.Message.(map[string]interface{}); ok {
		log.Printf("🔍 Message data: %+v", msgData)
		if uid, exists := msgData["user_id"]; exists {
			log.Printf("🔍 Found user_id: %v (type: %T)", uid, uid)
			if uidFloat, ok := uid.(float64); ok {
				userID = int(uidFloat)
				log.Printf("✅ Extracted userID: %d", userID)
			} else {
				log.Printf("❌ user_id is not float64: %T", uid)
			}
		} else {
			log.Printf("❌ No user_id found in message data")
		}
	} else {
		log.Printf("❌ Message is not map[string]interface{}: %T", broadcastReq.Message)
	}

	// Extract username from message data
	var username string
	if msgData, ok := broadcastReq.Message.(map[string]interface{}); ok {
		if uname, exists := msgData["username"]; exists {
			log.Printf("🔍 Found username: %v (type: %T)", uname, uname)
			if unameStr, ok := uname.(string); ok {
				username = unameStr
				log.Printf("✅ Extracted username: %s", username)
			} else {
				log.Printf("❌ username is not string: %T", uname)
			}
		} else {
			log.Printf("❌ No username found in message data")
		}
	}

	// Create WebSocket message for broadcasting
	wsMessage := WSMessage{
		Type:      MessageType(broadcastReq.Type),
		ChannelID: broadcastReq.ChannelID,
		UserID:    userID,
		Username:  username,
		Data:      broadcastReq.Message,
		Timestamp: time.Now(),
	}
	log.Printf("🔍 Created WSMessage: Type=%s, ChannelID=%v, UserID=%d", wsMessage.Type, wsMessage.ChannelID, wsMessage.UserID)

	// Respond to Python immediately (don't block)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "success"}`))

	// Broadcast asynchronously to avoid blocking the HTTP response
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("❌ Panic in broadcast goroutine: %v", r)
			}
		}()
		log.Printf("🔄 About to broadcast to channel %v, connected clients: %d", broadcastReq.ChannelID, len(hub.Clients))
		log.Printf("🚀 Calling hub.broadcastToChannel...")
		hub.broadcastToChannel(wsMessage)
		log.Printf("✅ Broadcasted message to channel %v", broadcastReq.ChannelID)
	}()
}
