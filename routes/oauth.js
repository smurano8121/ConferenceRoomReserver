var express = require('express');
var router = express.Router();

const fs = require('fs');
const mkdirp = require('mkdirp');
const readline = require('readline');
const { google } = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'credentials.json';

const User = require('../models/user');

let email
let oAuth2Client
router.get('/token', function (req, res, next) {
    console.log(req.query);
    oAuth2Client.getToken(req.query.code, (err, token) => {
        if (err) return callback(err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) console.error(err);
            console.log('Token stored to', TOKEN_PATH);
        });

        User.update(
            { "email": email },
            { "oauth": oAuth2Client },
            { upsert: true },
            function (err) {
                if (err) console.log(err);
            }
        );
    });
    res.redirect('http://ec2-13-115-229-145.ap-northeast-1.compute.amazonaws.com:3000');
});

router.get('/', function (req, res, next) {
    // Load client secrets from a local file.
    email = req.query.email
    fs.readFile('client_secret.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        authorize(JSON.parse(content));
    });

    function authorize(credentials) {
        const { client_secret, client_id, redirect_uris } = credentials.web;
        let token = {};
        oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);
        // Check if we have previously stored a token.
        try {
            token = fs.readFileSync(TOKEN_PATH);
        } catch (err) {
            console.log("トークンなかったよ");
            return getAccessToken(oAuth2Client);
        }
    }

    function getAccessToken(oAuth2Client) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        res.redirect(authUrl)
    }
});

module.exports = router;
