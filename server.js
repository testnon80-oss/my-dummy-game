const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/public'));

let rooms = {};

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
    let deck = [];
    for (let s of suits) {
        for (let v of values) {
            let score = 5;
            if (['10','J','Q','K'].includes(v)) score = 10;
            if (v === 'A') score = 15;
            if ((v === '2' && s === '♣') || (v === 'Q' && s === '♠')) score = 50; 
            deck.push({ suit: s, value: v, score: score, id: Math.random().toString(36).substr(2, 9) });
        }
    }
    return deck.sort(() => Math.random() - 0.5);
}

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomName, userName }) => {
        socket.join(roomName);
        if (!rooms[roomName]) {
            rooms[roomName] = { players: [], deck: [], pile: [], turn: 0, started: false };
        }
        rooms[roomName].players.push({ id: socket.id, name: userName, hand: [], melds: [] });
        io.to(roomName).emit('updateRoom', rooms[roomName]);
    });

    socket.on('startGame', (roomName) => {
        let room = rooms[roomName];
        if (room.players.length < 2) return;
        room.deck = createDeck();
        room.started = true;
        room.players.forEach(p => p.hand = room.deck.splice(0, 7));
        room.pile.push(room.deck.pop());
        io.to(roomName).emit('updateRoom', room);
    });

    // จั่วไพ่จากกอง
    socket.on('drawCard', (roomName) => {
        let room = rooms[roomName];
        let card = room.deck.pop();
        room.players[room.turn].hand.push(card);
        io.to(roomName).emit('updateRoom', room);
    });

    // ทิ้งไพ่
    socket.on('discard', ({ roomName, card }) => {
        let room = rooms[roomName];
        let player = room.players[room.turn];
        player.hand = player.hand.filter(c => c.id !== card.id);
        room.pile.push(card);
        room.turn = (room.turn + 1) % room.players.length; // เปลี่ยนตา
        io.to(roomName).emit('updateRoom', room);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));