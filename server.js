var express = require('express')
  , app = express()
  , BearerStrategy = require('passport-http-bearer').Strategy
  , config = require('./config')
  , controllers = require('./controllers')
  , faye = require('faye')
  , middleware = require('./middleware')
  , models = require('./models')
  , mongoose = require('mongoose')
  , passport = require('passport')
  , services = require('./services');

console.log("connecting to mongodb instance: " + config.mongodb_connection_string);
mongoose.connect(config.mongodb_connection_string);

app.use(express.logger());
app.use(express.bodyParser());

app.use(passport.initialize());
passport.use(new BearerStrategy({}, services.accessTokens.verify));

app.use(middleware.crossOrigin);

app.enable('trust proxy');
app.disable('x-powered-by');

// only establish routing to endpoints when we have a connection to MongoDB.
mongoose.connection.once('open', function () {
    console.log("service connected to mongodb.");

    services.initialize(function(err) {
        if (err) return console.log("Nitrogen service failed to initialize: " + err);
        if (!services.principals.systemPrincipal) return console.log("System principal not available after initialize.");

        console.log("service has initialized itself, exposing api at: " + config.base_url);

        var port = process.env.PORT || config.http_port || 3030;
        var server = app.listen(port);

        // REST endpoints

        app.get(config.api_prefix + 'v1/headwaiter',                                     controllers.headwaiter.index);

        app.get(config.api_prefix + 'v1/agents',         middleware.authenticateRequest, controllers.agents.index);

        if (config.blob_provider) {
            app.get(config.api_prefix + 'v1/blobs/:id',  middleware.authenticateRequest, controllers.blobs.show);
            app.post(config.api_prefix + 'v1/blobs',     /*middleware.authenticateRequest,*/ controllers.blobs.create);
        } else {
            console.log("WARNING: Not exposing blob endpoints because no blob provider is configured.");
        }

        app.get(config.api_prefix + 'v1/ops/health',                                     controllers.ops.health);

        app.get(config.api_prefix + 'v1/principals/:id', middleware.authenticateRequest, controllers.principals.show);
        app.get(config.api_prefix + 'v1/principals',     middleware.authenticateRequest, controllers.principals.index);
        app.post(config.api_prefix + 'v1/principals',                                    controllers.principals.create);
        app.post(config.api_prefix + 'v1/principals/auth',                               controllers.principals.authenticate);
        app.post(config.api_prefix + 'v1/principals/impersonate', middleware.authenticateRequest, controllers.principals.impersonate);

        app.get(config.api_prefix + 'v1/messages/:id',   middleware.authenticateRequest, controllers.messages.show);
        app.get(config.api_prefix + 'v1/messages',       middleware.authenticateRequest, controllers.messages.index);
        app.post(config.api_prefix + 'v1/messages',      middleware.authenticateRequest, controllers.messages.create);

        services.realtime.attach(server, config);

        app.use(express.static(__dirname + '/static'));

        // TODO: make starting this and API endpoint configurable to enable single vs. horizontally scaled deployments
        services.agents.start(config, function(err) {
            console.log("agent service failed to start: " + err);
        });
    });

});

if (process.env.NODE_ENV != "production") {
    mongoose.connection.on('error', function(err) {
        console.error('MongoDB error: %s', err);
    });
}
