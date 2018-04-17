var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var MessageLog = new Schema({
    userMessage: { type: String },
    aiMessage: { type: String },
    dateTime: { type: String },
    intentName: { type: String },
});

module.exports = mongoose.model('messageLog', MessageLog);