var BaseSchema = require('./baseSchema')
  ,	mongoose = require('mongoose')
  , Schema = mongoose.Schema;

var principalSchema = new BaseSchema();
principalSchema.add({
	type: { type: String },        // user, device
    name: { type: String },        // user friendly name for this principal

    public: { type: Boolean, default: false },
    owner: { type: Schema.Types.ObjectId, ref: 'Principal' },

	last_ip: { type: String },
	last_connection: { type: Date, default: Date.now },

    capabilities: { type: Array },

// device items

    secret_hash: { type: String },    // stored in base64

// user items

	email: { type: String },
	password_hash: { type: String },  // hashed and stored in base64
	salt: { type: String }            // stored in base64
});

principalSchema.index({ capabilities: 1 });
principalSchema.index({ email: 1 });
principalSchema.index({ last_ip: 1 });
principalSchema.index({ owner: 1 });
principalSchema.index({ public: 1 });
principalSchema.index({ type: 1 });

principalSchema.virtual('secret').set(function(value) { this._secret = value; });
principalSchema.virtual('secret').get(function() { return this._secret; });

principalSchema.virtual('password').set(function(value) { this._password = value; });
principalSchema.virtual('password').get(function() { return this._password; });

var principalObjectTransform = function(doc, ret, options) {
    BaseSchema.baseObjectTransform(doc, ret, options);

    delete ret.salt;
    delete ret.secret_hash;
    delete ret.password_hash;
};

principalSchema.set('toObject', { transform: principalObjectTransform });
principalSchema.set('toJSON', { transform: principalObjectTransform });

principalSchema.path('type').validate(function (value) {
    var invalid = false;

    if (!value)
        invalid = true;

    if (value != "device" && value != "system" && value != "user")
        invalid = true;

    return !invalid;
}, 'Principal must have valid type.');

var Principal = mongoose.model('Principal', principalSchema);

Principal.prototype.is = function(type) {
    return this.type === type;
};

module.exports = Principal;