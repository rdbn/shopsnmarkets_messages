#!/usr/bin/env node
var app = require('http').createServer(function(request, response) {
    console.log(request);
    console.log(response);
});

var open = require('amqplib').connect('amqp://localhost');
var io = require('socket.io')(app);

app.listen(8080, 'localhost');

var redis = require("redis");
var usersName = {};
var queueMessage = 'message';
var pub = redis.createClient();

/** check read for db */
var queueRabbit = function (queue, data) {
    open.then(function(conn) {
        var ok = conn.createChannel();
        ok = ok.then(function(ch) {
            ch.assertQueue(queue);
            ch.sendToQueue(queue, new Buffer(JSON.stringify(data)));
        });

        return ok;
    }).then(null, console.warn);
};

/**
 * Socket for send message user
 * */
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

        /**
         * Send message user
         * */
        socket.on('message', function (data) {
            if (usersName[data.to] != undefined) {
                try {
                    /** Publisher check read message */
                    pub.publish('check-read', JSON.stringify({
                        from: data.from,
                        to: data.to,
                        isReadMessage: true
                    }));

                    usersName[data.to].emit('message', data);
                } catch (e) {
                    console.log(e);
                }
            }

            /** Publisher send message from rabbitmq */
            queueRabbit(queueMessage, data);
        });

        /** when the user disconnects.. perform this */
        socket.on('disconnect', function() {
            /** remove the username from global usernames list */
            delete usersName[socket.username];
        });
    });

var usersNotRead = {};
var subscriberNotRead = redis.createClient();
subscriberNotRead.subscribe("not-read");

/**
 * Socket channel for check not-read/read message user
 * */
var notRead = io.of('/notRead')
    .on('connection', function (socket) {
        /** when the client emits 'addUser', this listens and executes */
        socket.on('addUser', function (data) {
            if (data.username == undefined)
                return false;

            console.log('connect: '+data.username);

            socket.username = data.username;
            usersNotRead[data.username] = socket;
        });

        /** Subscriber check not-read message */
        subscriberNotRead.on("message", function(channel, data) {
            data = JSON.parse(data);
            if (usersNotRead[data.username] == undefined)
                return false;

            try {
                usersNotRead[data.username].emit('not-read', data);
            } catch (e) {
                console.log(e);
            }
        });
    });

var queueCheckRead = 'check-read';
var usersCheckRead = {};

var subscriberCheckRead = redis.createClient();
subscriberCheckRead.subscribe("check-read");


/**
 * Socket channel for check read message user in chat
 * */
var checkRead = io.of('/checkRead')
    .on('connection', function (socket) {
        /** send isCheck read message */
        socket.on('check', function (data) {
            if (data.from == undefined)
                return false;

            console.log('connect: '+data.from);

            socket.username = data.from;
            usersCheckRead[data.from] = socket;

            data.isReadMessage = true;
            if (usersCheckRead[data.to] != undefined) {
                try {
                    usersCheckRead[data.to].emit('check-read', data);
                } catch (e) {
                    console.log(e);
                }

                /** Publisher send message from rabbitmq */
                queueRabbit(queueCheckRead, data);
            } else {
                data.isReadMessage = false;
                /** Publisher send message from rabbitmq */
                queueRabbit(queueCheckRead, data);
            }
        });

        /** Subscriber check read message */
        subscriberCheckRead.on("message", function(channel, data) {
            data = JSON.parse(data);
            if (usersCheckRead[data.username] == undefined)
                return false;

            try {
                usersCheckRead[data.username].emit('check-read', data);
            } catch (e) {
                console.log(e);
            }
        });
    });