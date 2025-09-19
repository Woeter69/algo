const socket = io();

const user1 = {{ session['user_id'] }};
const user2 = {{ other_user_id }};

// Join a unique room
socket.emit('join', { user1: user1, user2: user2 });

// Send message
function sendMessage() {
  const messageInput = document.getElementById('messageInput');
  const message = messageInput.value;
  if (!message) return;

  socket.emit('send_message', { sender_id: user1, receiver_id: user2, message: message });
  messageInput.value = '';
}

// Receive messages in real-time
socket.on('receive_message', data => {
  const chatBox = document.getElementById('chatBox');
  const div = document.createElement('div');
  div.textContent = (data.sender_id === user1 ? "You: " : "Them: ") + data.message;
  chatBox.appendChild(div);
});
