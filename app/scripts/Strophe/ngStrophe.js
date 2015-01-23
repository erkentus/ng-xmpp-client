'use strict';
/**
 * BOSH based XMPP module written angular way
 * @type {[type]}
 */
var strophe = angular.module('ngStrophe', []);

strophe.factory('Strophe', function() {
    if (!window.Strophe){
        throw new Error('Please make sure to include Strophe library. http://strophe.im/strophejs/');
    }
    return window.Strophe;
});

strophe.factory('StropheAPI', function(Strophe){
    var defaults = {
        //parameters
        boshUrl: null,
        host: null,
        username: null,
        password: null,
        email: null,
        //methods
        onConnStart: function(){
            console.log('Connecting...');
        },
        onDisconnStart: function(){
            console.log('Disconnecting...');
        },
        onConnSuccess: function(jid){
            console.log('Successfully connected. JID: ' + jid);
        },
        onConnFail: function(err){
            console.log('Failed to connect.', err);
        },
        onDisconnDone: function(){
            console.log('Disconnected.');
        },
        onMessage: function(msg){
            console.log('You got a message from ' + msg.from);
        },
        onMessageSent: function(){
            console.log('Your message is sent');
        }
    };
    var StropheAPI = function(settings){
        this.init(settings);
    };

    StropheAPI.prototype = {
        init: function(settings){
            angular.extend(this, defaults, settings);
            this.connection = new Strophe.Connection(this.boshUrl);
        },
        /**
         * login to the xmpp result
         * @param  {function} onConnStart  callback on connection start
         * @param  {function} onConnResult callback on connection established/failed
         * @return {[type]}              [description]
         */
        authenticate: function(){
            var self = this;
            //use self only to avoid confusion
            if (self.connection){
                self.connection.connect(self.username, self.password, function(status){
                    if (status === Strophe.Status.CONNECTING) {
                        self.onConnStart();
                    } else if (status === Strophe.Status.CONNFAIL) {
                        self.onConnFail('Strophe failed to connect. Make sure XMPP server is accessible and credentials are correct');
                    } else if (status === Strophe.Status.DISCONNECTING) {
                        self.onDisconnStart();
                    } else if (status === Strophe.Status.DISCONNECTED) {
                        self.onDisconnDone();
                    } else if (status === Strophe.Status.CONNECTED) {
                        self.onConnSuccess(self.connection.jid);
                        self.connection.addHandler(self.decodeMessage.bind(self), null, 'message', null, null, null);
                        self.connection.send(window.$pres().tree());
                    }
                });
            }
        },
        decodeMessage: function(msg){
            var from = msg.getAttribute('from');
            var type = msg.getAttribute('type');
            var elems = msg.getElementsByTagName('body');
            if (type === 'chat' && elems.length > 0) {
                var body = elems[0];
                this.onMessage({
                    from: from,
                    text: Strophe.getText(body)
                });
            }
            return true;
        },
        sendMessage: function(toJID, message){
            var self = this;
            if (!self.connection){
                console.error('Please create connection and login prior to sending messages');
                throw new Error('Cannot send message. Please login first');
            }
            if (self.connection.connected && self.connection.authenticated) {
                if (message.length > 0) {
                    var reply = window.$msg({
                        to: toJID,
                        from: self.connection.jid,
                        type: 'chat'
                    }).c('body').t(message);
                    self.connection.send(reply.tree());
                    self.onMessageSent();
                }
            }
        }
    };
    return StropheAPI;
});
