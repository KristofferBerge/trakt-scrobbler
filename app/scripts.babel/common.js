'use strict';

/////////////
// Variables
/////////////

var ContentType = {
    none : 0,
    series : 1,
    episode : 2,
    movie : 3
}

var LoadingState = {
    loading : 0,
    matched : 1,
    unmatched : 2,
    error : 3,
    episodeMissing : 4
}

var state = LoadingState.loading;

//Info scraped from the web page
var scrapedItem = {
    type : ContentType.none,
    title: undefined,
    originalTitle: undefined,
    episode: undefined,
    season: undefined,
    productionYear: undefined,
    itemKey: undefined
}

//Info about the item received from the trakt api
var matchedContent = {
    type : ContentType.none,
    title: undefined,
    traktId: undefined,
    episode: undefined,
    season: undefined,
    episodeId: undefined,
    episodeTitle: undefined,
    productionYear: undefined,
    watched: undefined,
    totalEpisodes: undefined,
    watchedEpisodes: undefined,
    nextUp: undefined,
    nextUpURL: undefined,
    searchResponse: undefined
}

///////////////////
// Event listeners
///////////////////

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (msg, sender, response) {
  if ((msg.from === 'popup') && (msg.subject === 'getContentInfo')) {
      var data = {
          status: state,
          scrapedInfo: scrapedItem,
          matchedInfo: matchedContent
      }
    response(data);
  }
  else if ((msg.from === 'apiCommunicator') && (msg.subject === 'updateWatchedStatus')) {
      //Scrobble event successfully registered on api. Update watched counter.
      updateWatchedStatus(msg.status);
  }
  else if ((msg.from === 'popup') && (msg.subject === 'setShowID')) {
      saveOverrideShowID(msg.id);
  }
  else if ((msg.from === 'popup') && (msg.subject === 'setMovieID')) {
      saveOverrideMovieID(msg.id);
  }
});

/////////////
// Functions
/////////////

function storeSearchResponse(response){
    if(response == undefined || response.length == 0){
        console.error('No search results received from trakt api.');
        state = LoadingState.unmatched;
        return;
    }
    //Keeping search response for the posibility of manual matching at a later point
    matchedContent.searchResponse = response;
}

function handleSearchResponse(response){
    console.log('Info received');
    console.log(response);
    if(response == undefined || response.length == 0){
        console.error('No search results received from trakt api.');
        state = LoadingState.unmatched;
        return;
    }
    //Keeping search response for the posibility of manual matching at a later point
    matchedContent.searchResponse = response;
    //Tv-show
    if(scrapedItem.type == 2){
        let bestGuess = response[0];        
        //TODO: Add support for site native sorting
        matchedContent.traktId = bestGuess.show.ids.trakt;
        matchedContent.title = bestGuess.show.title;
        matchedContent.type = 2;
        //Content matched to tv show. Get the specific episode
        getEpisode(handleEpisodeResponse);
    }
    //Movie
    else if(scrapedItem.type == 3){
        //First result is probably correct. Let's start there
        let bestGuess = response[0];
        matchedContent.type = 3;
        if(response.length > 1){
            if(scrapedItem.productionYear != undefined){
                //We have more than one result and also a production year
                //Let's try to find a result matching the production year
                for(var item of response){
                    if(item.movie.year == scrapedItem.productionYear){
                        bestGuess = item;
                        break;
                    }
                }
            }
        }
        matchedContent.traktId = bestGuess.movie.ids.trakt;
        matchedContent.title = bestGuess.movie.title;
        matchedContent.productionYear = bestGuess.productionYear;
        if(!isSignedIn){
            console.error('User is not signed in. Cannot get watched status');
            return;
        }
        getMovieWatchedStatus(handleMovieWatchedStatus);
    }
    //Episode or movie is matched to content. Safe to listen for play events.
    //Trigging site specific function to start native code.
    listenForScrobbleEvents();
}

function handleEpisodeResponse(response){
    if(response == undefined){
        //Episode was not found. There are two probable causes to this.
        //1. Content is matched to wrong show
        //2. The episode is not added to the show yet.
        state = LoadingState.episodeMissing;
    }
    else{
        matchedContent.episodeId = response.ids.trakt;
        matchedContent.episode = response.number;
        matchedContent.season = response.season;
        if(!isSignedIn){
            console.error('User is not signed in. Cannot get watched status');
            return;
        }
        getShowWatchedStatus(handleShowWatchedStatus);
    }
}
function handleShowWatchedStatus(response){
    console.log('checking watched status');
    console.log(response);
    matchedContent.totalEpisodes = response.aired;
    matchedContent.watchedEpisodes = response.completed;
    if(response.next_episode != undefined){
        matchedContent.nextUp = 'S' + response.next_episode.season + 'E' + response.next_episode.number;
        //Getting url for up next from domain native code. Undefined if not supported
        matchedContent.nextUpURL = getUpNextURL(response.next_episode.season,response.next_episode.number);
    }
    //Checking if current episode is watched
    outer:for(let s of response.seasons){
        //TODO: 0-padding might be a problem on some sites
        if(s.number == scrapedItem.season){
            for(let e of s.episodes){
                if(e.number == scrapedItem.episode){
                    matchedContent.watched = e.completed;
                    break outer;
                }
            }
        }
    }
    state = LoadingState.matched;
    triggerPopupRefresh();
}
function handleMovieWatchedStatus(response){
    if(response.length == 0){
        matchedContent.watched = false;
    }
    else{
        matchedContent.watched = true;
    }
    state = LoadingState.matched;
    triggerPopupRefresh();
}

function setContentAsWatched(progress = 100){
    matchedContent.watched = true;
    submitWatchedEvent(progress,matchedContent);
}
function setContentAsUnWatched(){
    matchedContent.watched = false;
    removeFromHistory(matchedContent);
}
function updateWatchedStatus(watched){
    matchedContent.watched = watched;
    watched? matchedContent.watchedEpisodes++:matchedContent.watchedEpisodes--;
    triggerPopupRefresh();
}
function triggerPopupRefresh(){
    chrome.runtime.sendMessage({
    from:    'content',
    subject: 'update',
    });
}

function saveOverrideShowID(id){
    console.warn('Overriding show ' + scrapedItem.itemKey + ' with trakt-id ' + id);
    chrome.storage.sync.get(['shows'], 
    function(items){
        console.log('Reading from override storage');
        console.log(items);
        //If array is not created
        if(items['shows'] == undefined){
            console.warn('No show override');
            var obj = {};
            obj[DOMAIN] = {};
            obj[DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'shows':obj});
        }
        else if(items['shows'][DOMAIN] == undefined){
            console.warn('No domain override');            
            items['shows'][DOMAIN] = {};
            items['shows'][DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'shows':items['shows']},start);            
        }
        else {
            console.warn('No item override');            
            items['shows'][DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'shows':items['shows']},start);
        }

    });
}
function saveOverrideMovieID(id){
    console.warn('Overriding movie ' + scrapedItem.itemKey + ' with trakt-id ' + id);
    chrome.storage.sync.get(['movies'], 
    function(items){
        //If array is not created
        if(items['movies'] == undefined){
            var obj = {};
            obj[DOMAIN] = {};
            obj[DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'movies':obj});
        }
        else if(items['movies'][DOMAIN] == undefined){
            items['movies'][DOMAIN] = {};
            items['movies'][DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'movies':items['movies']},start);            
        }
        else {
            items['movies'][DOMAIN][scrapedItem.itemKey] = id;
            chrome.storage.sync.set({'movies':items['movies']},start);
        }
    });
}

function checkForOverride(){
    if(scrapedItem.type == 2){
        chrome.storage.sync.get(['shows'], 
        function(items){
            console.log('Reading from override storage');
            console.log(items);
            if(items['shows'] != undefined && items['shows'][DOMAIN] != undefined && items['shows'][DOMAIN][scrapedItem.itemKey] != undefined){
                //OVERRIDE
                findItemByTraktId(items['shows'][DOMAIN][scrapedItem.itemKey],handleSearchResponse);
                //Get search results anyway
                findItem(storeSearchResponse);
            }
            else{
                findItem(handleSearchResponse);
            }
        });
    }
    else if(scrapedItem.type == 3){
        chrome.storage.sync.get(['movies'], 
        function(items){
            console.log('Reading from override storage');
            console.log(items);
            if(items['movies'] != undefined && items['movies'][DOMAIN] != undefined && items['movies'][DOMAIN][scrapedItem.itemKey] != undefined){
                //OVERRIDE
                findItemByTraktId(items['movies'][DOMAIN][scrapedItem.itemKey],handleSearchResponse);
                //Get search results anyway
                findItem(storeSearchResponse);
            }
            else{
                findItem(handleSearchResponse);
            }
        });
    }
}

//////////////////
// Initialization
//////////////////

//Detected supported page. 
//Sending show page action to background script to display red trakt icon and enable popup
chrome.runtime.sendMessage({
  from:    'content',
  subject: 'showPageAction'
});

//Check if user is logged in. Don't start scripts if not.
var isSignedIn = false;
chrome.storage.sync.get(['traktToken'], 
    function(items){
        if(items['traktToken'] != undefined){
            isSignedIn = true;
        }
});

//Domain specific script should contain method named scrape
function start() {
    //Resetting scraped values
    scrapedItem.type  = ContentType.none,
    scrapedItem.title = undefined,
    scrapedItem.originalTitle = undefined,
    scrapedItem.episode = undefined,
    scrapedItem.season = undefined,
    scrapedItem.productionYear = undefined

    if(!scrape()){
        console.info('Scraping failed. No content present on site?');
        //Stop here if no content is found
        state = LoadingState.error;
        return;
    }
    else{
        console.log('Scraping successfully finished.');
        console.log(scrapedItem);
    }
    //Before searching, check if override is saved
    checkForOverride();
    //Search trakt api for item matching scraped info
    //findItem(handleSearchResponse);
}
start();
