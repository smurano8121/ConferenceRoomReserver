const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const http = require('http');
const mongoose = require('mongoose');

const index = require('./routes/index');
const registration = require('./routes/registration');
const messageLog = require('./routes/messageLog');
const users = require('./routes/users');

const app = express();

mongoose.Promise = global.Promise;
const mongodbUri = 'mongodb://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com/meetingRoomReserver';
const mongOptions = {
  useMongoClient: true,
  socketTimeoutMS: 0,
  keepAlive: true,
  reconnectTries: 30
};

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ポート設定
app.set('httpport', process.env.PORT || 3000);

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index)
app.use('/registration', registration);
app.use('/messageLog', messageLog);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

const server = http.createServer(app).listen(app.get('httpport'), function () {
  console.log('Express HTTP server listening on port ' + app.get('httpport'));
  // mongoose.connect(mongodbUri, mongOptions);
});

module.exports = app;
