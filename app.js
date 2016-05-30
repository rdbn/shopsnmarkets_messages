var io = require('socket.io')(8080);
var usersName = {};

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
            if (usersName[data.username] == undefined)
                return false;

            try {
                usersName[data.username].emit('message', data);
            } catch (e) {
                console.log(e);
            }
        });

        /** when the user disconnects.. perform this */
        socket.on('disconnect', function() {
            /** remove the username from global usernames list */
            delete usersName[socket.username];
        });
    });

var news = io.of('/news')
    .on('connection', function (socket) {
        socket.on('message', function (data) {
            if (usersName[data.username] == undefined)
                return false;

            try {
                usersName[data.username].emit('message', data);
            } catch (e) {
                console.log(e);
            }
        });
    });