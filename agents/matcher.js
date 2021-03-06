function createIpMatchMessage(session, user, device, callback) {

    nitrogen.Message.find(session, {
        from: user.id,
        type: 'reject',
        body: { principal: device.id }
    }, {}, function(err, messages) {
        if (err) return callback(err);
        if (messages.length > 0) {
            log.info("matcher: reject message exists for user: " + user.id + " and device: " + device.id + " not creating ip_match");
            return callback(null, null);
        }

        nitrogen.Message.find(session, {
            type: 'ip_match',
            body: { principal: device.id }
        }, {}, function(err, messages) {
            if (err) return callback(err);
            if (messages.length > 0) {
                log.info("matcher: ip_match message exists for device: " + device.id + " not creating ip_match");
                return callback(null, null);
            }

            log.info("matcher: creating ip_match message for device: " + device.id);

            var matchMessage = new nitrogen.Message({ 
                type: 'ip_match',
                to: user.id,
                body: {
                    principal: device.id
                }
            });

            matchMessage.send(session, callback);
        });
    });
}

function sendIpMatchMessages(message, devices, users) {
    nitrogen.Principal.find(session, { _id: message.from }, {}, function(err, fromPrincipals) {
        if (err) return log.error("matcher: error finding principal: " + err);
        if (fromPrincipals.length === 0) return log.warn("matcher: didn't find principal with id (possibly deleted in the meantime?): " + message.from);

        var fromPrincipal = fromPrincipals[0];

        /* for device 'ip' messages we only generate one ip_match message from the user to that device. */

        if (fromPrincipal.is('user')) {
            /* for each device at this IP address that is not currently owned by a principal, emit an ip_match message. */
            var user = fromPrincipal;

            async.each(devices, function(device, callback) {
                if (!device.owner) createIpMatchMessage(session, user, device, callback);
            }, completionCallback);

        } else {
            /* create an ip_match message for this device. */
            var device = fromPrincipal;
            if (!device.owner) createIpMatchMessage(session, users[0], device, completionCallback);
        }
    });
}

function completionCallback(err) {
    if (err) log.error("createIPMatchMessage finished with an error: " + err);
}

function processIpMessage(message) {
    nitrogen.Principal.find(session, { last_ip: message.body.ip_address }, {}, function(err, principalsAtIp) {
        if (err) return log.error('matcher: error looking for principals at this ip address: ' + err);
        var devices = [];
        var users = [];

        principalsAtIp.forEach(function(principal) {
            log.info("matcher: principal at ip: " + principal.type + ":" + principal.id);

            if (principal.is('user'))
                users.push(principal);
            else if (principal.is('device'))
                devices.push(principal);
        });

        log.info("matcher: users length: " + users.length + " devices length: " + devices.length);

        if (users.length != 1) return log.info("matcher: not exactly one user at this ip address. can't match devices.");

        sendIpMatchMessages(message, devices, users);
    });
}

session.onMessage(function(message) {
    if (message.is('ip')) {
        log.info("matcher: processing ip message");

        processIpMessage(message);
    }
});
