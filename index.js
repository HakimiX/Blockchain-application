const SHA256 = require("crypto-js/sha256");
var WebSocket = require("ws");
var express = require("express");
var bodyParser = require("body-parser");

var HTTP_PORT = process.env.HTTP_PORT || 3001;
var P2P_PORT = process.env.P2P_PORT || 4000;
var PEER = process.env.PEERS ? process.env.PEERS.split(',') : [];

var SOCKETS = [];
var MESSAGETYPE = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCHAIN: 2
};

class Block {

    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;

        // Hash property, contains has of block
        this.hash = this.generateHash();
    }

    generateHash() {
        return SHA256(
            this.index + 
            this.previousHash + 
            this.timestamp + 
            JSON.stringify(this.data)).toString();
    }
}

class Blockchain {

    constructor() {
        this.blockchain = [this.generateGenesisBlock()];
    }

    generateGenesisBlock() {
        return new Block(0, "04/07/2017", "Genesis Block", "0");
    }

    generateNewBlock(data) {
        var previousBlock = latestBlock();

        var newIndex = previousBlock.index + 1;
        var newTimestamp = new Date().getTime() / 1000;
        var newHash = generateHash(newIndex, previousBlock.hash, newTimestamp, data);

        return new Block(newIndex, previousBlock.hash, newTimestamp, data, newHash);
    }

    addBlock(newBlock) {

        // Set previousHash
        newBlock.previousHash = this.latestBlock().hash;

        // Push to blockchain
        this.blockchain.push(newBlock);
    }

    latestBlock(){
        return this.blockchain[this.blockchain.length - 1];
    }

    validateBlock() {
        return "helo";
    }
}

// Instance
var blokchainClass = new Blockchain();
var blockClass = new Block();

var blockchain = [blokchainClass.generateGenesisBlock()];

// Network
var Socketconnection = (ws) => {
    SOCKETS.push(ws);
};

var p2pConnection = (newPeer) => {
    newPeer.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => Socketconnection(ws));
        ws.on('error', () => {
            console.log('Connection failed')
        });
    });
};

var latestMessage = () => ({
    'type': MESSAGETYPE.RESPONSE_BLOCHAIN,
    'data': JSON.stringify([blokchainClass.latestBlock()])
});

var broadcast = (message) => {
    SOCKETS.forEach(socket => write(socket, message));
};



// HTTP
var HTTP_SERVER = () => {
    var app = express();
    app.use(bodyParser.json());

    // GET - /blocks
    app.get('/blocks', (req, res) => res.send(JSON.stringify(blockchain)));

    // GET - /peers
    app.get('/peers', (req, res) => {
        res.send(SOCKETS.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });

    // POST - /mine
    app.post('/mine', (req, res) => {
        var newBlock = blokchainClass.generateNewBlock(req.body.data);

        blokchainClass.addBlock(newBlock);

        // Notify everyone
        broadcast(latestMessage());

        console.log('Added Block: ' + JSON.stringify(newBlock));
        
        res.send();
    });

    // POST - /addPeer
    app.get('/addPeer', (req, res) => {
        p2pConnection([req.body.peer]);
        res.send();
    });

    app.listen(HTTP_PORT, () => console.log('HTTP ready port: ' + HTTP_PORT));
};

// P2P
var P2P_SERVER = () => {
    var p2pServer = new WebSocket.Server({port: P2P_PORT});
    p2pServer.on('connection', ws => Socketconnection(ws));
    console.log('P2P ready port: ' + P2P_PORT);
};


p2pConnection(PEER);
HTTP_SERVER();
P2P_SERVER();


