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
// let client_secret
// let client_id
// const redirect_uris = 'http://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com:3000/oauth/token';
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
        // console.log(oAuth2Client);
        User.update(
            { "email": email },
            { "oauth": oAuth2Client },
            { upsert: true },
            function (err) {
                if (err) console.log(err);
            }
        );
    });
    res.redirect('http://ec2-13-115-41-122.ap-northeast-1.compute.amazonaws.com:3000');
});

router.get('/', function (req, res, next) {
    // Load client secrets from a local file.
    email = req.query.email
    fs.readFile('client_secret.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
        // Authorize a client with credentials, then call the Google Drive API.
        console.log(JSON.parse(content));
        authorize(JSON.parse(content), listEvents);
    });

    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    function authorize(credentials, callback) {
        const { client_secret, client_id, redirect_uris } = credentials.web;
        let token = {};
        const oAuth2Client = new google.auth.OAuth2(
            client_id, client_secret, redirect_uris[0]);

        // Check if we have previously stored a token.
        try {
            token = fs.readFileSync(TOKEN_PATH);
        } catch (err) {
            return getAccessToken(oAuth2Client, callback);
        }
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);

        // client_secret = credentials.web.client_secret;
        // client_id = credentials.web.client_id;
        // // redirect_uris = 'http://localhost:3000/oauth/token';
        // oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris);

        // // Check if we have previously stored a token.
        // fs.readFile(TOKEN_PATH, (err, token) => {
        //     if (err) return getAccessToken(oAuth2Client, callback);
        //     // oAuth2Client.setCredentials(JSON.parse(token));
        //     // callback(oAuth2Client);
        //     getAccessToken(oAuth2Client, callback);
        // });
    }

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback for the authorized client.
     */
    function getAccessToken(oAuth2Client, callback) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });
        res.redirect(authUrl)
    }

    /**
     * Lists the next 10 events on the user's primary calendar.
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    function listEvents(auth) {
        const calendar = google.calendar({ version: 'v3', auth });
        calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        }, (err, { data }) => {
            if (err) return console.log('The API returned an error: ' + err);
            const events = data.items;
            if (events.length) {
                console.log('Upcoming 10 events:');
                events.map((event, i) => {
                    const start = event.start.dateTime || event.start.date;
                    console.log(`${start} - ${event.summary}`);
                });
            } else {
                console.log('No upcoming events found.');
            }
        });
    }
});

module.exports = router;
