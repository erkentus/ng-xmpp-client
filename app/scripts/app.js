'use strict';

/**
 * @ngdoc overview
 * @name xmppChatApp
 * @description
 * # xmppChatApp
 *
 * Main module of the application.
 */
var app = angular
    .module('xmppChatApp', [
        'ngAnimate',
        'ngRoute',
        'stropheModule'
    ])
    .config(function($routeProvider) {
        $routeProvider
            .when('/', {
                templateUrl: 'views/main.html',
                controller: 'MainCtrl'
            })
            .otherwise({
                redirectTo: '/'
            });
    });

app.service('serverConfig', function($http) {
    this.getJSON = function() {
        return $http.get('xmppServer.json');
    };
});


app.controller('MainCtrl', function($scope, stropheService, toast) {
    $scope.chat = {
        state: 'offline'
    };
    $scope.sentMessages = [];
    $scope.receivedMessages = [];
    $scope.contacts = [
        {
            jid: 'admin@yerkens-macbook-pro.local',
            name: 'admin'
        }
    ];
    $scope.authenticate = function() {
        if ($scope.connectForm.$valid) {
            stropheService.authenticate($scope.form.username, $scope.form.password, $scope.form.email).then(function(defer) {
                toast(defer.message, 3000);
                defer.resultPromise.then(function(success) {
                    toast(success.message, 3000);
                    $scope.chat.state = 'online';
                }, function(error) {
                    console.log(error);
                }, function(updated) {
                    console.log(updated);
                });
            }, function(error) {
                console.log(error);
            });
        }
    };
    $scope.$on('messageReceived', function(event, data) {
        toast('New Message', 3000);
        $scope.receivedMessages.push(data);
        $scope.$digest();
        console.log(data);
    });
    $scope.sendMessage = function() {
        if ($scope.messageForm.$valid){
            stropheService.sendMessage($scope.message.recepient, $scope.message.text);
            console.log($scope.message);
            $scope.sentMessages.push({
                to: $scope.message.recepient,
                text: $scope.message.text
            });
            $scope.message.text = '';
        }
    };
});

app.factory('toast', function() {
    return window.toast;
});

app.service('stropheService', function(Strophe, serverConfig, $q, $rootScope) {

    this._connection = null;
    this._email = null;
    this.authenticate = function(username, password, email) {
        var self = this;
        self._email = email;
        var deferred = $q.defer();
        var promise = deferred.promise;
        var deferredResult = $q.defer();
        var deferredPromise = deferredResult.promise;
        serverConfig.getJSON().then(function(data) {
            var config = data.data;
            var serverName = config.serverName;
            var boshUrl = config.boshUrl;
            self._connection = new Strophe.Connection(boshUrl);
            self._connection.connect(username + '@' + serverName, password, function(status) {
                if (status === Strophe.Status.CONNECTING) {
                    deferred.resolve({
                        message: 'Connecting...',
                        resultPromise: deferredPromise
                    });
                } else if (status === Strophe.Status.CONNFAIL) {
                    deferred.reject('Failed to connect');
                } else if (status === Strophe.Status.DISCONNECTING) {
                    deferred.resolve({
                        message: 'Disconnecting...',
                        resultPromise: deferredPromise
                    });
                } else if (status === Strophe.Status.DISCONNECTED) {
                    deferredResult.resolve('Disconnected');
                } else if (status === Strophe.Status.CONNECTED) {
                    deferredResult.resolve({
                        message: 'You are connected',
                        jid: self._connection.jid
                    });
                    self._connection.addHandler(onMessage, null, 'message', null, null, null);
                    self._connection.send($pres().tree());
                }
            });
        });

        var onMessage = function(msg) {
            var from = msg.getAttribute('from');
            var type = msg.getAttribute('type');
            var email = msg.getAttribute('email');
            var elems = msg.getElementsByTagName('body');

            if (type === 'chat' && elems.length > 0) {
                var body = elems[0];
                $rootScope.$broadcast('messageReceived', {
                    from: from,
                    text: Strophe.getText(body),
                    email: email
                });
            }

            // we must return true to keep the handler alive.
            // returning false would remove it after it finishes.
            return true;
        };

        this.sendMessage = function(to, text) {
            var self = this;
            serverConfig.getJSON().then(function(data) {
                var config = data.data;
                var destJID = to;
                // var destJID = to + '@' + config.serverName;
                if (self._connection.connected && self._connection.authenticated) {
                    if (text.length > 0) {
                        var reply = $msg({
                            to: destJID,
                            from: self._connection.jid,
                            type: 'chat',
                            email: self._email
                        }).c('body').t(text);

                        self._connection.send(reply.tree());
                    }
                } else {

                }
            });
        };
        return promise;
    };
});

var strophe = angular.module('stropheModule', []);

strophe.factory('Strophe', function() {
    return window.Strophe;
});
