var express = require('express');
var router = express.Router();

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
// var { googleAuth } = require('google-auth-library');
const gal = require('google-auth-library');
var request = require('request');

const User = require('../models/user');

const testPass = "password";
const testUserId = "test";
const testUserName = "testUser";


router.get('/token', function (req, res, next) {
    console.log(req.query.code);
    res.redirect('http://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com:3000');
});


router.get('/', function (req, res, next) {
    // If modifying these scopes, delete your previously saved credentials
    // at ~/.credentials/calendar-nodejs-quickstart.json

    var SCOPES = ['https://www.googleapis.com/auth/calendar'];
    var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';
    var TOKEN_PATH = TOKEN_DIR + 'calendar-nodejs-quickstart.json';

    console.log(TOKEN_PATH);


    // Load client secrets from a local file.
    fs.readFile('client_secret.json', function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Calendar API.
        authorize(JSON.parse(content));
    });

    function authorize(credentials) {
        var clientSecret = credentials.installed.client_secret;
        var clientId = credentials.installed.client_id;
        // var redirectUrl = credentials.installed.redirect_uris[0];
        var redirectUrl = 'http://localhost:3000/auth/token';
        // var auth = new gal.GoogleAuth();
        // const jwtClient = new gal.JWT();
        const oAuth2Client = new gal(clientId, clientSecret, redirectUrl);
        // var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

        // Check if we have previously stored a token.
        fs.readFile(TOKEN_PATH, function (err, token) {
            if (err) {
                getNewToken(oauth2Client);
            } else {
                console.log("もうtoken持ってる\n");
                oauth2Client.credentials = JSON.parse(token);

                //ここで'/chat'にoauth2Clientをpostしたい

                User.find({ "userid": testUserId }, function (err, result) {
                    if (result.length == 0) {
                        var user = new User();

                        user.userid = testUserId;
                        user.username = testUserName;
                        user.password = testPass;
                        user.oauth = oauth2Client;

                        user.save(function (err) {
                            if (err) console.log(err);
                        });
                    }
                });
                // callback(oauth2Client);
                res.redirect("https://www.yahoo.co.jp/");
            }
        });
    }

    function getNewToken(oauth2Client) {
        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        console.log('Authorize this app by visiting this url: ', authUrl);
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter the code from that page here: ', function (code) {
            rl.close();
            oauth2Client.getToken(code, function (err, token) {
                if (err) {
                    console.log('Error while trying to retrieve access token', err);
                    return;
                }
                oauth2Client.credentials = token;
                storeToken(token);
                User.find({ "userid": testUserId }, function (err, result) {
                    if (result.length == 0) {
                        var user = new User();

                        user.userid = testUserId;
                        user.username = testUserName;
                        user.password = testPass;
                        user.oauth = oauth2Client;

                        user.save(function (err) {
                            if (err) console.log(err);
                        });
                    }
                });
            });
        });
    }

    // function getNewToken(oauth2Client,code,callback) {
    //   console.log("in getNewToken\n")
    //   var authUrl = oauth2Client.generateAuthUrl({
    //     access_type: 'offline',
    //     scope: SCOPES
    //   });
    //   console.log('Authorize this app by visiting this url: ', authUrl);
    //   res.redirect(authUrl);

    //   oauth2Client.getToken(code, function(err, token) {
    //     if (err) {
    //       console.log('Error while trying to retrieve access token', err);
    //       return;
    //     }
    //     oauth2Client.credentials = token;
    //     storeToken(token);
    //     callback(oauth2Client);
    //   });
    // }

    /**
     * Store token to disk be used in later program executions.
     *
     * @param {Object} token The token to store to disk.
     */
    function storeToken(token) {
        try {
            fs.mkdirSync(TOKEN_DIR);
        } catch (err) {
            if (err.code != 'EEXIST') {
                throw err;
            }
        }
        fs.writeFile(TOKEN_PATH, JSON.stringify(token));
        console.log('Token stored to ' + TOKEN_PATH);
    }

    /**
     * Lists the next 10 events on the user's primary calendar.
     *
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */

    function enterCode(oauth2Client, code) {
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client);
        });
    }
});

module.exports = router;
