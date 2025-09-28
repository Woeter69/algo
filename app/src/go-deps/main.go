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
	JoinChannel    MessageType = "join_channel"
	LeaveChannel   MessageType = "leave_channel"
	
	// Message events (for both /channels and /chat)
	SendMessage    MessageType = "send_message"
	NewMessage     MessageType = "new_message"
	
	// Direct chat events (for /chat/<username>)
	JoinChatRoom   MessageType = "join_chat_room"
	LeaveChatRoom  MessageType = "leave_chat_room"
	ChatMessage    MessageType = "chat_message"
	NewChatMessage MessageType = "new_chat_message"
	
	// Typing events (for both)
	TypingStart    MessageType = "typing_start"
	TypingStop     MessageType = "typing_stop"
	UserTyping     MessageType = "user_typing"
	
	// User status events
	UserJoined     MessageType = "user_joined"
	UserLeft       MessageType = "user_left"
	UserOnline     MessageType = "user_online"
	UserOffline    MessageType = "user_offline"
)

// WebSocket message structure - handles both channels and direct chat
type WSMessage struct {
	Type        MessageType `json:"type"`
	ChannelID   interface{} `json:"channel_id,omitempty"`   // For /channels (can be string or int)
	ChatRoom    string      `json:"chat_room,omitempty"`    // For /chat (e.g., "user_1_user_2")
	SenderID    int         `json:"sender_id,omitempty"`    // For direct chat
	ReceiverID  int         `json:"receiver_id,omitempty"`  // For direct chat
	UserID      int         `json:"user_id"`
	Username    string      `json:"username"`
	Content     string      `json:"content,omitempty"`
	MessageID   string      `json:"message_id,omitempty"`
	CreatedAt   string      `json:"created_at,omitempty"`
	PfpPath     string      `json:"pfp_path,omitempty"`
	Data        interface{} `json:"data,omitempty"`
	Timestamp   time.Time   `json:"timestamp"`
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
	
	// Chat rooms: room_name -> map of clients in that chat (/chat)
	ChatRooms map[string]map[int]*Client
	
	// Typing users in channels: channel_id -> set of user IDs typing
	ChannelTyping map[int]map[int]bool
	
	// Typing users in chat rooms: room_name -> set of user IDs typing  
	ChatTyping map[string]map[int]bool
	
	// Communication channels
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan WSMessage
	
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

// Global variables
var (
	db  *sql.DB
	hub *Hub
)

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
		Broadcast:     make(chan WSMessage),
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
			// Broadcast message to channel
			h.handleBroadcast(message)
		}
	}
}

// Handle different types of messages
func (h *Hub) handleBroadcast(message WSMessage) {
	switch message.Type {
	case NewMessage:
		h.broadcastToChannel(message)
	case ChatMessage:
		h.handleChatMessage(message)
	case UserTyping:
		h.handleTyping(message)
	case JoinChannel:
		h.handleJoinChannel(message)
	case LeaveChannel:
		h.handleLeaveChannel(message)
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
	h.Mutex.RLock()
	defer h.Mutex.RUnlock()
	
	channelID := getChannelID(message.ChannelID)
	if channelClients, exists := h.Channels[channelID]; exists {
		for userID, client := range channelClients {
			// Don't send back to sender
			if userID != message.UserID {
				select {
				case client.Send <- message:
					// Message sent successfully
				default:
					// Client disconnected, clean up
					close(client.Send)
					delete(channelClients, userID)
				}
			}
		}
	}
	
	log.Printf("📢 Broadcasted message in channel %d from %s", channelID, message.Username)
}

// Handle user joining a channel
func (h *Hub) handleJoinChannel(message WSMessage) {
	h.Mutex.Lock()
	defer h.Mutex.Unlock()
	
	// Verify user has access to this channel (check database)
	channelID := getChannelID(message.ChannelID)
	if !h.verifyChannelAccess(message.UserID, channelID) {
		log.Printf("❌ User %d denied access to channel %d", message.UserID, channelID)
		return
	}
	
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
	log.Printf("💬 Chat message from %s to %d: %s", message.Username, message.ReceiverID, message.Content)
	
	// Save message to database
	if h.DB != nil {
		h.saveChatMessage(message)
	}
	
	// Send to receiver if online
	if receiverClient, exists := h.Clients[message.ReceiverID]; exists {
		response := WSMessage{
			Type:       NewChatMessage,
			UserID:     message.UserID,
			Username:   message.Username,
			Content:    message.Content,
			ReceiverID: message.ReceiverID,
			PfpPath:    message.PfpPath,
			Timestamp:  message.Timestamp,
		}
		
		select {
		case receiverClient.Send <- response:
			log.Printf("✅ Message delivered to user %d", message.ReceiverID)
		default:
			log.Printf("❌ Failed to deliver message to user %d", message.ReceiverID)
		}
	} else {
		log.Printf("📴 User %d is offline, message saved for later", message.ReceiverID)
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
		
		// Handle message
		c.Hub.Broadcast <- message
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
		"status": "healthy",
		"service": "go-websocket-server",
		"time": time.Now().Format(time.RFC3339),
	})
}

func main() {
	log.Println("🚀 Starting Go WebSocket server...")
	
	// Get port from environment variable (Render sets this)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default for local development
	}
	log.Printf("📡 Port: %s", port)
	
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

	// Initialize Google OAuth (optional - only if needed)
	if os.Getenv("GOOGLE_CLIENT_ID") != "" {
		oauth := NewGoogleOAuth(db)
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
	
	log.Printf("🚀 WebSocket server starting on port %s", port)
	log.Printf("🌐 Binding to: 0.0.0.0:%s (all interfaces)", port)
	log.Printf("🌐 WebSocket endpoint: ws://localhost:%s/ws", port)
	log.Printf("🌐 WebSocket endpoint: ws://127.0.0.1:%s/ws", port)
	log.Printf("🌐 WebSocket endpoint: ws://192.168.56.131:%s/ws", port)
	log.Printf("❤️  Health check: http://localhost:%s/health", port)
	log.Printf("❤️  Health check: http://127.0.0.1:%s/health", port)
	log.Printf("🧪 Test endpoint: http://localhost:%s/test", port)
	
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("❌ Server failed to start:", err)
	}
}
