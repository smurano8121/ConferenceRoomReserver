const { google } = require('googleapis');
const OAuth2Client = google.auth.OAuth2;
const TOKEN_PATH = 'credentials.json';
const fs = require('fs');
require('date-utils');

exports.authorizeInsertEvents = function (credentials, registData, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.web;
    let token = {};
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    // Check if we have previously stored a token.
    try {
        token = fs.readFileSync(TOKEN_PATH);
    } catch (err) {
        console.log({ "fulfillmentText": "トークンを取得できませんでした" });
    }
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client,registData);
}

exports.insertEvents = function(auth, registData) {
    var calendar = google.calendar('v3');
    var startTimeJP = registData.startTime;
    var endTimeJP = registData.endTime;
    startTimeJP.setHours(registData.startTime.getHours());
    endTimeJP.setHours(registData.endTime.getHours())
    console.log("registData.startTime"+registData.startTime)
    console.log("startTimeJP"+startTimeJP)
    console.log("registData.endTime"+registData.endTime)
    console.log("endTimeJP"+endTimeJP)
    console.log(registData.attendees)

    var event = {
        'summary': registData.summary,
        'start': {
            'dateTime': startTimeJP,
            'timeZone': 'Asia/Tokyo',
        },
        'end': {
            'dateTime': endTimeJP,
            'timeZone': 'Asia/Tokyo',
        },
        'attendees': registData.attendees
    };

    calendar.freebusy.query({
        auth: auth,
        headers: { "content-type" : "application/json" },
        resource: {
            items: [
                {id : registData.room},
                {id : "reservation@mikilab.doshisha.ac.jp"}
            ], 
            timeMin: startTimeJP,
            timeMax: endTimeJP,
            "timeZone": 'Asia/Tokyo'
        } 
    },function(err,response){
        if (err) {
                console.log("エラーーーー");
                console.log('There was an error contacting the Calendar service: ' + err);
                return;
        }   
        var events = response.data.calendars[registData.room].busy;
        if (events.length == 0) {
            calendar.events.insert({
                auth: auth,
                calendarId: 'primary',
                resource: event,
            }, function (err, event) {
                if (err) {
                    console.log('There was an error contacting the Calendar service: ' + err);
                    return;
                }
                console.log('Event created: %s', event.htmlLink);
            });
        } else {
            console.log('busy in here...');
        }   
    });
}

exports.checkFreeBusy = function(auth, registData){
    var calendar = google.calendar('v3');
    calendar.freebusy.query({
        auth: auth,
        headers: { "content-type" : "application/json" },
        resource: {
            items: [
                {id : registData.room}
            ], 
            timeMin: registData.startDateTime,
            timeMax: registData.finishDateTime,
            "timeZone": 'Asia/Tokyo'
        } 
    },function(err,response){
        if (err) {
                console.log("エラー");
                console.log('There was an error contacting the Calendar service: ' + err);
                return;
        }   
        var events = response.data.calendars[registData.room].busy;
        if (events.length == 0) {
            console.log('free in here...');
        } else {
            console.log('busy in here...');
        }   
    });

}

exports.listEvents = function(auth, startDate, callback) {
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