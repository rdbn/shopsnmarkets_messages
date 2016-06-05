#!/usr/bin/env node
var app = require('http').createServer(function(request, response) {
    console.log(request);
    console.log(response);
});

var open = require('amqplib').connect('amqp://localhost');
var io = require('socket.io')(app);

app.listen(8080, 'localhost');

var redis = require("redis");
var subscriber = redis.createClient();

var usersName = {};
var queue = 'message';

var chat = io.of('/chat')
    .on('connection', function (socket) {
        /** when the client emits 'addUser', this listens and executes */
        socket.on('addUser', function (data) {
            if (data.username == undefined)
                return false;

            console.log('connect: '+data.username);

            socket.username = data.username;
            usersName[data.username] = socket;
        });

        socket.on('message', function (data) {
            if (usersName[data.to] != undefined) {
                try {
                    usersName[data.to].emit('message', data);
                } catch (e) {
                    console.log(e);
                }
            }

            /** Publisher send message from rabbitmq */
            open.then(function(conn) {
                var ok = conn.createChannel();
                ok = ok.then(function(ch) {
                    ch.assertQueue(queue);
                    ch.sendToQueue(queue, new Buffer(JSON.stringify(data)));
                });

                return ok;
            }).then(null, console.warn);
        });

        /** when the user disconnects.. perform this */
        socket.on('disconnect', function() {
            /** remove the username from global usernames list */
            delete usersName[socket.username];
        });
    });

subscriber.subscribe("not-read");
var notRead = io.of('/notRead')
    .on('connection', function (socket) {
        /** when the client emits 'addUser', this listens and executes */
        socket.on('addUser', function (data) {
            if (data.username == undefined)
                return false;

            console.log('connect: '+data.username);

            socket.username = data.username;
            usersName[data.username] = socket;
        });

        subscriber.on("message", function(channel, data) {
            data = JSON.parse(data);
            if (usersName[data.to] == undefined)
                return false;

            try {
                usersName[data.to].emit('not-read', data);
            } catch (e) {
                console.log(e);
            }
        });
    });