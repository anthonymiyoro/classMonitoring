/* eslint-disable no-console */

// Get the party started
$(function() {

    // Socket connection to EBS
    var socket = io('https://localhost:9999', {
        autoConnect: false
    });

    // WebSocket Handlers
    socket.on('connect', () => {
        console.log("Socket connected successfully, my Socket ID is " + socket.id);
    });
    socket.on('connect_error', (err) => {
        console.log("Failed to connect to socket:", err);
    });
    socket.on('connect_timeout', (timeout) => {
        console.log("Socket connection timed out:", timeout);
    });
    socket.on('error', (err) => {
        console.log("Socket error:", err);
    });
    socket.on('disconnect', (reason) => {
        console.log("Socket disconnected:", reason);
    });
    socket.on('reconnect', (attemptNumber) => {
        console.log("Successfully reconnected to socket after " + attemptNumber + " attempts");
    });
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log("Attempting reconnect... " + attemptNumber);
    });
    socket.on('reconnect_error', (err) => {
        console.log("Failed to reconnect to socket:", err);
    });
    socket.on('test', (msg) => {
        console.log("New socket 'test' message:", msg);
    });
    socket.on('whisper', (msg) => {
        console.log("New socket 'whisper' message:", msg);
    });


    // Twitch function handlers
    var twitch = window.Twitch.ext;
    var firstTimeOnly = true;
    var latestAuth = {};

    // This bit of disgustingness is to deal with a bug (28/11/2017) in the Twitch JS Helper.
    // Normally you would call listen for the whisper channel inside onAuthorized when you get
    // your opaque ID, however, calling twitch.listen inside onAuthorise causes the listen
    // function to be registered more than one time for some reason. So we wait for onAuth to
    // be called and then register the listener here.
    function whisperHack() {
        if (!firstTimeOnly) {
            // Listen to this viewer's private PubSub whisper channel
            twitch.listen('whisper-'+latestAuth.userId, (target, type, msg) => {
                console.log("New Twitch PubSub whisper:", msg);
            });
        } else {
            setTimeout(whisperHack, 1000);
        }
    }
    whisperHack();

    // onAuth handler. Gives us JWT and the viewer's opaque ID
    twitch.onAuthorized((auth) => {
        console.log("Twitch: onAuthorized called");
        console.log("The channel ID is", auth.channelId);
        // console.log("The extension clientId is", auth.clientId);
        console.log("My Twitch opaque user id is", auth.userId);
        // console.log("The JWT token is", auth.token);

        // var channel_Id = auth.channelId.toString();
        // console.log("Channel ID Below")
        // console.log(channel_Id)

        latestAuth = auth;
        // Set up the header for requests
        $.ajaxSetup({
            headers: {
                'x-twitch-jwt': latestAuth.token
            }
        });

        // Update the socket query with new JWT
        socket.io.opts.query = {
            jwt: auth.token
        };

        if (firstTimeOnly) {
            firstTimeOnly = false;

            // Open the websocket
            socket.open();
        }
        // run function that sets the username of streamer
        getStreamerName(auth.channelId);
       
    });

    // Sub all viewers to the broadcast channel
    twitch.listen('broadcast', (target, type, msg) => {
        console.log("New Twitch PubSub broadcast message:", msg);
    });


    // Error handler
    twitch.onError((err) => {
        console.log("Twitch: onError called");
        console.log("The error was", err);
    });
    // onContext handler. Providers viewer mode, resolution, delay and other stuff
    // This can be very spammy, commented out by default
    twitch.onContext((context, diff) => {
        // console.log("Twitch: onContext called");
        // console.log(context);
        // console.log(diff);
    });
});


// channelId getters and setters
var setGlobalChannelName = (function(global) {
return function(value) {
global.twitch_channel_id = value;
}
}(this));
var getGlobalChannelName = (function(global) {
    return function() {
    return global.twitch_channel_id;
    }
}(this));


//  // get streamer name so we can analyse the chat
//  function getStreamerName(channel_id) {
//   var options = { method: 'GET',
//   url: 'https://api.twitch.tv/helix/users',
//   qs: { id: 154139682 },
//   headers: { 'Client-ID': 's72s2j2mm94920a4hk4921e5vc67ks' }};
//   request(options, function (error, response, body) {
//       if (error) throw new Error(error);
//       // Collect login name from response
//       // console.log(body);
//       var channel_detail = JSON.parse(body);
//       console.log(channel_detail);
//       channel_name = channel_detail[0];
//       console.log(channel_name);
//       setGlobalChannelName(channel_name);

//       // return calculated sentiment to previous function
//   });
// }

// Collect form with channel name and send post request to /collect_channel_name view
// It then hides the form
function startLogging() {
    var streamer_id = document.getElementById("streamerID").value;
    var form_id = document.getElementById("formDiv");
    console.log("streamer_id", streamer_id);
    setGlobalChannelName(streamer_id);
    $.ajax({
        type: "POST",
        url: "/collect_channel_name",
        contentType: "application/json",
        data: JSON.stringify({ channel_Id: streamer_id}),
        success: function(data) {
        //   console.log('message sent', data);
        },
        error: function(jqXHR, textStatus, err) {
            alert('text status '+textStatus+', err '+err)
        }
    }); 
    form_id.style.display='none';
    startWorker()
}   

// Collect form with channel name and send post request to /collect_channel_name view
// It then hides the form
function ignoreForm() {
    var form_id = document.getElementById("formDiv");
    form_id.style.display='none';
    startWorker()
}   
    
// Worker that checks the sentiment of comments every 5 seconds
function startWorker(){

    (function worker() {
        var channel_id = getGlobalChannelName();
        // console.log("channel_id", channel_id);
            $.ajax({
                type: "POST",
                url: "/collect_chat_analysis",
                contentType: 'application/json',
                data: JSON.stringify({ channel_Id: channel_id}),
                success: function(data) {
                // on success write somethibg to HTML
                // { "average_sentiment": 0.27 }
                    var average_sentiment = data.average_sentiment;
                    if (average_sentiment > 0.048){
                        var mood = "Awesome!!";
                        var img = document.createElement("IMG");
                        img.src = "images/awesome.gif";
                        
                    }
                    else if (average_sentiment > 0.024 && average_sentiment < 0.048 ){
                        mood = "Positive";
                        img = document.createElement("IMG");
                        img.src = "images/happy.gif";
                        
                    }
                    else if (average_sentiment > -0.019 && average_sentiment< 0.024){
                        mood = "Neutral";
                        img = document.createElement("IMG");
                        img.src = "images/neutral.gif";
                        
                    }
                    else if (average_sentiment < -0.020 && average_sentiment > -0.031){
                        mood = "Miffed";
                        img = document.createElement("IMG");
                        img.src = "images/miffed.gif";
                        
                    }
                    else if (average_sentiment <  -0.031 && average_sentiment > -1){
                        mood = "Bad";
                        img = document.createElement("IMG");
                        img.src = "images/bad.gif"; 
                    }
                    else{
                        mood = "Error"+ average_sentiment ;
                    }
                    var div = document.querySelector("#viewer_sentiment");
                    div.innerHTML = "Your chat room is feeling "+ mood;
    
                    var image_div = document.querySelector("#imageDiv1");
                    image_div.innerHTML ='<img id="sentiment_image" src=' + img.src + '  class="img-thumbnail"></img>';
                    // document.getElementById('imageDiv').style.backgroundImage = img.src;
                },
                complete: function() {
                        // Schedule the next request when the current one's complete
                        setTimeout(worker, 10000);
                    }
            });
    })();
}




// Collect streamers channelId from twitch and send to backend where it 
// will be converted to the streamer name. From backend analyssi of chat room 
// will stop.

function stopLogging(auth){
    var channel_id = auth.channelId.toString()
    $.ajax({
        type: "POST",
        url: "/collect_channel_name",
        contentType: 'application/json',
        data: JSON.stringify({ channel_Id: channel_id}),
        success: function(data) {
        // console.log('message', data.message);
        },
        error: function(jqXHR, textStatus, err) {
            alert('text status '+textStatus+', err '+err)
        }
    });
}