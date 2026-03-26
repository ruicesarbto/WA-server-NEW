const socketIO = require("socket.io");
const { query } = require("./database/dbpromise");

let ioInstance; // Global variable to store the io instance

function initializeSocket(server) {
  const io = socketIO(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
    },
  });

  // Save the io instance to the global variable
  ioInstance = io;

  // Socket.IO event handling
  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    socket.on("user_connected", async ({ userId }) => {
      console.log({ userId });
      if (userId) {
        console.log(
          `User ${userId?.slice(0, 5)} connected with socket ID: ${socket.id}`
        );
        try {
          // Perform database operations within a try-catch block for error handling
          await query(`DELETE FROM rooms WHERE uid = ?`, [userId]);
          await query(`INSERT INTO rooms (uid, socket_id) VALUES (?, ?)`, [
            userId,
            socket.id,
          ]);
        } catch (error) {
          console.error("Error executing database queries:", error);
          // Handle error gracefully, such as sending an error response to the client
        }
      }
    });

    socket.on("get_chats", async ({ userId }) => {
      try {
        // Buscar chats do banco de dados (PostgreSQL) — Adaptado para uid e last_message_at
        const chats = await query(
          'SELECT * FROM chats WHERE uid = ? ORDER BY last_message_at DESC LIMIT 200',
          [userId]
        );
        socket.emit("chats_list", chats);
      } catch (err) {
        console.error("[Socket:get_chats] Error:", err.message);
      }
    });

    socket.on("get_messages", async ({ chatId, instanceId, userId }) => {
      try {
        // Buscar mensagens do banco (PostgreSQL) — Adaptado para chat_id e message_timestamp
        // Importante: Filtramos por uid e instanceId por segurança
        const messages = await query(
          'SELECT * FROM messages WHERE chat_id = ? AND instance_id = ? AND uid = ? ORDER BY message_timestamp ASC LIMIT 100',
          [chatId, instanceId, userId]
        );
        socket.emit("messages_list", { chatId, messages });
      } catch (err) {
        console.error("[Socket:get_messages] Error:", err.message);
      }
    });

    socket.on("disconnect", async () => {
      console.log(`A user disconnected with socket ID: ${socket.id}`);
      try {
        await query(`DELETE FROM rooms WHERE socket_id = ?`, [socket.id]);
      } catch (error) {
        console.error("Error executing database query:", error);
      }
    });
  });

  return io; // Return io instance
}

// Export a function to get the io instance
function getIOInstance() {
  return ioInstance;
}

module.exports = { initializeSocket, getIOInstance };
