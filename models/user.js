var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var User = new Schema({
    email: { type: String, require: true, unique: true },
    name: { type: String, require: true },
    password: { type: String, require: true },
    studentNumber: { type: String, require: true, unique: true },
    oauth: { type: Object }
});

module.exports = mongoose.model('user', User);