var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Room = new Schema({
    address: { type: String, require: true, unique: true },
    name: { type: String, require: true },
});

module.exports = mongoose.model('room', Room);