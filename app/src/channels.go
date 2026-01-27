package main

import (
	"database/sql"
	"log"
	"time"
)

// Channel message types are now defined in main.go to avoid duplication

// Channel message structure
type ChannelMessage struct {
	MessageID           int       `json:"message_id"`
	ChannelID           int       `json:"channel_id"`
	UserID              int       `json:"user_id"`
	Content             string    `json:"content"`
	MessageType         string    `json:"message_type"`
	ReplyToMessageID    *int      `json:"reply_to_message_id,omitempty"`
	IsEdited            bool      `json:"is_edited"`
	IsDeleted           bool      `json:"is_deleted"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           *time.Time `json:"updated_at,omitempty"`
	Username            string    `json:"username"`
	Firstname           string    `json:"firstname"`
	Lastname            string    `json:"lastname"`
	PfpPath             string    `json:"pfp_path"`
}

// Handle channel message sending
func (h *Hub) handleSendChannelMessage(message WSMessage) {
	log.Printf("📤 Handling send channel message from %s to channel %v", message.Username, message.ChannelID)
	
	// Get user info for broadcasting (do this first, it's fast)
	userInfo := h.getUserInfo(message.UserID)
	
	// Create broadcast message immediately (before database save)
	broadcastMessage := WSMessage{
		Type:      NewMessage,
		ChannelID: message.ChannelID,
		UserID:    message.UserID,
		Username:  userInfo.Username,
		Content:   message.Content,
		MessageID: "temp", // Temporary ID
		CreatedAt: time.Now().Format(time.RFC3339),
		PfpPath:   userInfo.PfpPath,
		Timestamp: time.Now(),
	}
	
	// Broadcast immediately for instant delivery
	log.Printf("🚀 Broadcasting message immediately for speed")
	h.broadcastToChannel(broadcastMessage)
	
	// Save to database asynchronously (don't block real-time delivery)
	go func() {
		messageID := h.saveChannelMessage(message)
		if messageID == 0 {
			log.Printf("❌ Failed to save channel message")
		} else {
			log.Printf("✅ Channel message saved with ID: %d", messageID)
		}
	}()
	
	log.Printf("✅ Channel message broadcasted instantly: %s", message.Content[:min(50, len(message.Content))])
}

// Handle typing indicators for channels (fast, non-blocking)
func (h *Hub) handleChannelTyping(message WSMessage) {
	log.Printf("⌨️ Handling typing from %s in channel %v", message.Username, message.ChannelID)
	
	// Create typing broadcast message
	typingMessage := WSMessage{
		Type:      UserTyping,
		ChannelID: message.ChannelID,
		UserID:    message.UserID,
		Username:  message.Username,
		Data:      message.Data, // Contains typing: true/false
		Timestamp: time.Now(),
	}
	
	// Fast, non-blocking broadcast for typing indicators
	go func() {
		h.fastBroadcastToChannel(typingMessage)
	}()
}

// Save channel message to database
func (h *Hub) saveChannelMessage(message WSMessage) int {
	if h.DB == nil {
		log.Printf("⚠️ No database connection, message not saved")
		return 0
	}
	
	channelID := getChannelID(message.ChannelID)
	
	query := `
		INSERT INTO channel_messages (channel_id, user_id, content, message_type, created_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING message_id
	`
	
	var messageID int
	err := h.DB.QueryRow(query, channelID, message.UserID, message.Content, "text", time.Now()).Scan(&messageID)
	if err != nil {
		log.Printf("❌ Error saving channel message: %v", err)
		return 0
	}
	
	log.Printf("✅ Channel message saved with ID: %d", messageID)
	return messageID
}

// Handle get channel messages request
func (h *Hub) handleGetChannelMessages(message WSMessage) {
	log.Printf("📋 *** HANDLING GET CHANNEL MESSAGES *** for channel %v requested by user %s", message.ChannelID, message.Username)
	
	channelID := getChannelID(message.ChannelID)
	
	// Verify user has access to this channel
	if !h.verifyChannelAccess(message.UserID, channelID) {
		log.Printf("❌ User %d denied access to channel %d", message.UserID, channelID)
		return
	}
	
	// Get messages from database
	messages := h.getChannelMessagesFromDB(channelID)
	
	// Send messages back to requesting client
	if client, exists := h.Clients[message.UserID]; exists {
		response := WSMessage{
			Type:      ChannelHistory,
			ChannelID: message.ChannelID,
			UserID:    message.UserID,
			Username:  message.Username,
			Data: map[string]interface{}{
				"channel_id": channelID,
				"messages":   messages,
			},
			Timestamp: time.Now(),
		}
		
		select {
		case client.Send <- response:
			log.Printf("✅ Sent %d messages to user %s for channel %d", len(messages), message.Username, channelID)
		default:
			log.Printf("❌ Failed to send messages to user %s", message.Username)
		}
	}
}

// Get channel messages from database
func (h *Hub) getChannelMessagesFromDB(channelID int) []ChannelMessage {
	if h.DB == nil {
		log.Println("⚠️ No database connection, returning empty messages")
		return []ChannelMessage{}
	}
	
	query := `
		SELECT 
			cm.message_id,
			cm.channel_id,
			cm.user_id,
			cm.content,
			cm.message_type,
			cm.reply_to_message_id,
			cm.is_edited,
			cm.is_deleted,
			cm.created_at,
			cm.updated_at,
			u.username,
			u.firstname,
			u.lastname,
			u.pfp_path
		FROM channel_messages cm
		JOIN users u ON cm.user_id = u.user_id
		WHERE cm.channel_id = $1 AND cm.is_deleted = false
		ORDER BY cm.created_at ASC
		LIMIT 50
	`
	
	rows, err := h.DB.Query(query, channelID)
	if err != nil {
		log.Printf("❌ Error querying messages for channel %d: %v", channelID, err)
		return []ChannelMessage{}
	}
	defer rows.Close()
	
	var messages []ChannelMessage
	
	for rows.Next() {
		var msg ChannelMessage
		var pfpPath sql.NullString
		var updatedAt sql.NullTime
		var replyToMessageID sql.NullInt32
		
		err := rows.Scan(
			&msg.MessageID,
			&msg.ChannelID,
			&msg.UserID,
			&msg.Content,
			&msg.MessageType,
			&replyToMessageID,
			&msg.IsEdited,
			&msg.IsDeleted,
			&msg.CreatedAt,
			&updatedAt,
			&msg.Username,
			&msg.Firstname,
			&msg.Lastname,
			&pfpPath,
		)
		if err != nil {
			log.Printf("❌ Error scanning message row: %v", err)
			continue
		}
		
		// Handle nullable fields
		if pfpPath.Valid {
			msg.PfpPath = pfpPath.String
		}
		if updatedAt.Valid {
			msg.UpdatedAt = &updatedAt.Time
		}
		if replyToMessageID.Valid {
			replyID := int(replyToMessageID.Int32)
			msg.ReplyToMessageID = &replyID
		}
		
		messages = append(messages, msg)
	}
	
	log.Printf("📋 Retrieved %d messages for channel %d", len(messages), channelID)
	return messages
}

// User info structure
type UserInfo struct {
	Username string
	PfpPath  string
}

// Get user info from database
func (h *Hub) getUserInfo(userID int) UserInfo {
	if h.DB == nil {
		return UserInfo{Username: "Unknown", PfpPath: ""}
	}
	
	var userInfo UserInfo
	query := `SELECT username, COALESCE(pfp_path, '') FROM users WHERE user_id = $1`
	
	err := h.DB.QueryRow(query, userID).Scan(&userInfo.Username, &userInfo.PfpPath)
	if err != nil {
		log.Printf("❌ Error getting user info for user %d: %v", userID, err)
		return UserInfo{Username: "Unknown", PfpPath: ""}
	}
	
	return userInfo
}

// min function is defined in main.go

// Note: getChannelID, verifyChannelAccess, and broadcastToChannel functions 
// are already defined in main.go, so we don't redefine them here
