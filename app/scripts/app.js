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
        'ngCookies',
        'ngStrophe',
        'underscore'
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

app.service('myInfo', function() {
    this.jid = null;
});

app.controller('MainCtrl', function($scope, chatClient, messageManager) {
    $scope.chat = {
        online: false
    };
    $scope.sentMessages = [];
    $scope.receivedMessages = [];
    $scope.dialogMessages = [];
    $scope.selectedContact = null;
    $scope.contacts = [];
    // $scope.contacts = [{
    //     jid: 'admin@yerkens-macbook-pro.local/Yerkens-MacBook-Pro',
    //     name: 'admin',
    //     newMessages: false
    // }];
    $scope.login = function(username, password, email) {
        if ($scope.connectForm.$valid) {
            chatClient.connect(username, password, email, function(jid) {
                $scope.chat.online = true;
                $scope.myJid = jid;
                $scope.$digest();
            });
        }
    };
    $scope.$on('messageReceived', function(event, data) {
        $scope.dialogMessages = messageManager.getMessageByContact(data.author);
        $scope.$digest();
    });
    $scope.sendMessage = function() {
        if ($scope.messageForm.$valid) {
            chatClient.sendMessage($scope.message.recepient, $scope.message.text);
            $scope.sentMessages.push({
                to: $scope.message.recepient,
                text: $scope.message.text
            });
            $scope.message.text = '';
        }
    };
    $scope.onContactSelected = function(contact) {
        $scope.selectedContact = contact;
        $scope.dialogMessages = messageManager.getMessageByContact($scope.selectedContact.jid);
        contact.newMessages = false;
    };
    $scope.unselectContact = function() {
        $scope.selectedContact = null;
    };
    $scope.messageSeen = function(contact) {
        if (contact) contact.newMessages = false;
    };
    $scope.openAddContactModal = function() {
        $('#add-contact-modal').openModal();
    };
    $scope.addContact = function() {
        $scope.contacts.push({
            jid: $scope.newContact,
            name: messageManager.getContactName($scope.newContact),
            newMessages: false
        });
        $('#add-contact-modal').closeModal();
    };
});

app.service('chatClient', function(StropheAPI, serverConfig, $rootScope, toast, messageManager, myInfo) {
    var stropheAPI = null;

    this.connect = function(username, password, email, onConnect) {
        var self = this;
        serverConfig.getJSON().then(function(data) {
            var config = data.data;
            stropheAPI = new StropheAPI({
                boshUrl: config.boshUrl,
                username: username + '@' + config.serverName,
                password: password,
                email: email,
                onConnStart: function() {
                    toast('Connecting...', 3000);
                },
                onDisconnStart: function() {
                    toast('Disconnecting...', 3000);
                },
                onConnSuccess: function(jid) {
                    toast('Successfully connected. JID: ' + jid, 3000);
                    myInfo.jid = jid;
                    onConnect(jid);
                },
                onConnFail: function() {
                    toast('Failed to connect', 3000);
                },
                onDisconnDone: function() {
                    toast('Failed to connect', 3000);
                },
                onMessage: function(msg) {
                    self.onMessage(msg);
                },
                onMessageSent: function() {}
            });
            stropheAPI.authenticate();
        });
    };
    this.sendMessage = function(jid, message) {
        console.log(message);
        if (stropheAPI) {
            stropheAPI.sendMessage(jid, message);
            var msg = {
                to: jid,
                author: myInfo.jid,
                text: message,
                type: 'outcome',
                date: new Date()
            };
            messageManager.addOutcomeMessage(msg);
        }
    };
    this.onMessage = function(msg) {
        toast('New message', 3000);
        msg.author = msg.from;
        msg.to = myInfo.jid;
        msg.type = 'income';
        msg.date = new Date();
        messageManager.addIncomeMessage(msg);
        $rootScope.$broadcast('messageReceived', {
            author: msg.from,
            text: msg.text
        });
    };
});

app.factory('toast', function() {
    return window.toast;
});

app.directive('dialogBox', function(chatClient, messageManager) {
    return {
        restrict: 'E',
        templateUrl: 'scripts/dialogBox/dialogBox.html',
        link: function(scope) {
            scope.sendDialogMessage = function() {
                if (scope.dialogForm.$valid) {
                    chatClient.sendMessage(scope.selectedContact.jid, scope.dialogMessage.text);
                    scope.dialogMessage.text = '';
                    scope.dialogMessages = messageManager.getMessageByContact(scope.selectedContact.jid);
                }
            };
        }
    };
});

app.service('messageManager', function(_) {
    var income = [];
    var outcome = [];
    this.getAllMessages = function() {
        return _.union(income, outcome);
    };
    this.addIncomeMessage = function(msg) {
        income.push(msg);
    };
    this.addOutcomeMessage = function(msg) {
        outcome.push(msg);
    };
    this.getMessagesByAuthor = function(jid) {
        return _.filter(_.union(income, outcome), function(message) {
            return message.author === jid;
        });
    };
    this.getMessageByContact = function(jid) {
        if (!jid) return [];
        return _.sortBy(_.filter(_.union(income, outcome), function(message) {
            return message.author === jid || message.to === jid;
        }), function(msg) {
            return msg.date;
        });
    };

    this.getContactName = function(jid) {
        return jid.substring(0, jid.indexOf('@'));
    };
});

app.directive('contactList', function(messageManager) {
    return {
        restrict: 'E',
        templateUrl: 'scripts/contacts/list.html',
        link: function(scope) {
            var self = this;
            scope.$on('messageReceived', function(event, msg) {
                var found = false;
                scope.contacts.forEach(function(contact) {
                    if (msg.author === contact.jid) {
                        contact.newMessages = true;
                        scope.$digest();
                        found = true;
                    }
                });
                if (!found) {
                    scope.contacts.push({
                        jid: msg.author,
                        name: messageManager.getContactName(msg.author),
                        newMessages: true
                    });
                    scope.$apply();
                }
            });

        }
    };
});

var underscore = angular.module('underscore', []);

underscore.factory('_', function() {
    window._.findAndSplice = function(array, predicate) {
        for (var i = 0; i < array.length; i++) {
            if (predicate(array[i])) {
                array.splice(i, 1);
                return;
            }
        }
    };
    return window._;
});
