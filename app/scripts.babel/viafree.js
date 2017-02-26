'use strict';
//Variables scrapedItem and matchedContent are made available by manifest.json

var interval;
var url;
var listenForPlayedEvent = false;
var scrobbleSent = false;

////////////////////////////
// Trigged by common script
////////////////////////////

function scrape(){
    if(document.getElementsByClassName('main-content-wrapper')[0] == undefined){
        scrapedItem.type = ContentType.none;
        //Content div was not found.
        return false;
    }
    //Viafree has no movies. Only tv shows.
    else{
        scrapedItem.type = ContentType.episode;        
        scrapedItem.title = document.getElementsByClassName('format-title')[0].innerHTML;
        //Must find if content is ContentType.episode
        scrapedItem.episode = document.getElementsByClassName('episodeNumber')[0].children[1].innerHTML.split(' ')[1];
        scrapedItem.season = document.getElementsByClassName('thumbnail-season')[0].children[0].innerHTML.split(' ')[1];
        return true;
    }
}

function listenForScrobbleEvents(){
    listenForPlayedEvent = true;
}

function getUpNextURL(season, episode){
    var loc = document.URL.split('//')[1].split('/');
    loc[loc.length-2] = 'sesong-' + season;
    loc[loc.length-1] = 'episode-' + episode;
    return 'https://' + loc.join('/');
}


///////////////////////////
// Site specific code
//////////////////////////

//Detecting if URL changes without navigation
//URL change means we need to scrape again
interval = setInterval(routineCheck,1000);
function routineCheck(){
    if(document.URL != url){
        //Navigation has happened. Make common script start over
        listenForPlayedEvent = false;
        scrobbleSent = false;
        start();
    }
    url = document.URL;

    if(listenForPlayedEvent){
        var adLabel = document.getElementsByClassName('ad-countdown')[0];
        if(adLabel != undefined && adLabel.innerHTML.length == 0){
            //Ad label is present if video player is displayed
            //If ad is playing, innerHTML will be greater than 0
            var element = document.getElementsByClassName('vjs-progress-holder')[0];
            var progress = element.getAttribute('aria-valuenow');
            var playedForMinutes = parseInt(element.getAttribute('aria-valuetext').split(':')[0]);
            //When probing video progress attribute, restult may be 100% at initial startup
            //Checking that video has been playing for at least one minute
            if(parseInt(progress) > 90 && scrobbleSent == false && playedForMinutes > 0){
                console.warn('Detected 90% + duration. Sending scrobble event');
                scrobbleSent = true;
                setContentAsWatched(90);
            }
        }
    }
}