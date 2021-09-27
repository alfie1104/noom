import http from "http";
import express from "express";
import SocketIO from "socket.io";
//import WebSocket from "ws";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/public/views");
app.use("/public", express.static(__dirname + "/public"));

app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log("Listening on http://localhost:3000");

//http서버와 web socket 서버를 모두 같은 포트에서 동시에 돌리기 위해 http를 이용해서 서버생성하였음
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
  socket.onAny((event) => {
    console.log(`Socket Event:${event}`);
  });
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome");
  });
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => socket.to(room).emit("bye"));
  });
  socket.on("new_message", (msg, room, done) => {
    socket.to(room).emit("new_message", msg);
    done();
  });
});
/*
//이렇게 함으로써 websocket 서버가 http서버 위에서 구동됨
const wsServer = new WebSocket.Server({ httpServer });
const sockets = [];

wsServer.on("connection", (socket) => {
  sockets.push(socket);
  socket["nickname"] = "Anon";

  //각 socket에 close, message 등의 이벤트 리스너를 등록함
  //server에 등록하지 않았음에 유의!
  console.log("Connected to Browser");

  socket.on("close", () => {
    console.log("Disconnected from the Browser : ❌");
  });

  socket.on("message", (msg) => {
    const message = JSON.parse(msg);
    switch (message.type) {
      case "new_message":
        sockets.forEach((aSocket) => {
          aSocket.send(`${socket.nickname}: ${message.payload}`);
        });
        break;
      case "nickname":
        socket["nickname"] = message.payload;
        break;
      default:
        console.log(message.payload);
    }
  });

  socket.send(`${socket.nickname}: hello!`);
});
*/

httpServer.listen(3000, handleListen);
