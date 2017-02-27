'use strict';

document.getElementById('setSeriesWatchedButton').addEventListener('click',markContentAsWatched);
document.getElementById('setMovieWatchedButton').addEventListener('click',markContentAsWatched);
document.getElementById('setSeriesUnWatchedButton').addEventListener('click',markContentAsUnWatched);
document.getElementById('setMovieUnWatchedButton').addEventListener('click',markContentAsUnWatched);
document.getElementById('nextUp').addEventListener('click',navigateToNextEpisode);
document.getElementById('manualMatchButton').addEventListener('click',matchManually);
//Just trigger refresh if cancelled
document.getElementById('cancelManualMatchButton').addEventListener('click',queryActiveTabForInfo);

var infoBuffer;

function ensureLoggedIn(){
  chrome.storage.sync.get(['traktToken'], 
        function(items){
          console.log(items);
          if(items['traktToken'] == undefined){
            hideAll();
            document.getElementById('loginMessage').style.display = 'block';
          }
          else{
              console.info('User is logged in');
          }
    });
}

function hideAll(){
  document.getElementById('movieInfo').style.display = 'none';
  document.getElementById('episodeInfo').style.display = 'none';
  document.getElementById('loginMessage').style.display = 'none';
  document.getElementById('loadingMessage').style.display = 'none';
  document.getElementById('traktId').style.display = 'none';
  document.getElementById('noContent').style.display = 'none';
  document.getElementById('addShow').style.display = 'none';
  document.getElementById('addMovie').style.display = 'none';
  document.getElementById('nextUp').style.display = 'none';
  document.getElementById('manualMatchContainer').style.display = 'none';
  document.getElementById('manualMatchButton').style.display = 'none';
  
}

function markContentAsWatched(){
  submitWatchedEvent(100,infoBuffer.matchedInfo);
  infoBuffer.matchedInfo.watched = true;
  displayContentInfo(infoBuffer);
}

function markContentAsUnWatched(){
  removeFromHistory(infoBuffer.matchedInfo)
  infoBuffer.matchedInfo.watched = false;
  displayContentInfo(infoBuffer);
}

//Receives watched status (boolean) and displays badge and buttons accordingly
function displayWatchedStatus(watched){
  //For episode
  document.getElementById('watchedStatus').innerHTML = watched?'watched':'unwatched';
  document.getElementById('watchedStatus').style.background = watched?'#00c92b':'lightGray';
  document.getElementById('setSeriesWatchedButton').style.display = watched?'none':'inline';
  document.getElementById('setSeriesUnWatchedButton').style.display = watched?'inline':'none';
  //For movie
  document.getElementById('movieWatchedStatus').innerHTML = watched?'watched':'unwatched';
  document.getElementById('movieWatchedStatus').style.background = watched?'#00c92b':'lightGray';
  document.getElementById('setMovieWatchedButton').style.display = watched?'none':'inline';
  document.getElementById('setMovieUnWatchedButton').style.display = watched?'inline':'none';
}

function displayContentInfo(info){
  infoBuffer = info;
  console.info(info);
  ensureLoggedIn();
  hideAll();
  //Checking if info is still loading
  if(info.status == 0){
    //Stop if still loading. Content script will trigger refresh when done.
    document.getElementById('loadingMessage').style.display = 'block';
    return;
  }
  //If no content was found on page
  else if(info.scrapedInfo.type == 0){
      document.getElementById('noContent').style.display = 'block';
  }
  //If content is of type episode
  else if(info.scrapedInfo.type == 2){
    document.getElementById('episodeInfo').style.display = 'block';
    document.getElementById('seriesSeason').innerHTML = 'Season: ' + info.scrapedInfo.season;
    document.getElementById('seriesEpisode').innerHTML = 'Episode: ' + info.scrapedInfo.episode;
    //First, set title to scraped content name and void link
    document.getElementById('seriesName').innerHTML = info.scrapedInfo.title;
    document.getElementById('seriesTraktUrl').setAttribute('href','javascript:void(0)');    
    if(info.status == 1){
      //Then, if match was found in the database, show the matched title and link the content id
      document.getElementById('seriesName').innerHTML = info.matchedInfo.title;
      document.getElementById('seriesTraktUrl').setAttribute('href','https://trakt.tv/shows/' + info.matchedInfo.traktId);
      //Setting range and state of progress bar
      document.getElementById('seriesProgressBar').setAttribute('max', info.matchedInfo.totalEpisodes);
      document.getElementById('seriesProgressBar').setAttribute('value',info.matchedInfo.watchedEpisodes);
      document.getElementById('seriesProgressText').innerHTML = info.matchedInfo.watchedEpisodes + '/' + info.matchedInfo.totalEpisodes + ' watched.';
      if(info.matchedInfo.nextUp != undefined){
        document.getElementById('nextUp').style.display = 'inline';
        document.getElementById('nextUp').innerHTML = 'Up next: ' + info.matchedInfo.nextUp;
      }
      displayWatchedStatus(info.matchedInfo.watched);
    }
    document.getElementById('manualMatchButton').style.display = 'block';    
  }
  //If content is of type movie
  else if(info.scrapedInfo.type == 3){
    document.getElementById('movieInfo').style.display = 'block';    
    //First, set title to scraped content name and void link    
    document.getElementById('movieName').innerHTML = info.scrapedInfo.title;
    document.getElementById('movieTraktUrl').setAttribute('href','javascript:void(0)');    
    if(info.scrapedInfo.productionYear != undefined){
      document.getElementById('movieProductionYear').innerHTML = '(' + info.scrapedInfo.productionYear + ')';
    }
    //Then, if match was found in the database, show the matched title and link the content id    
    if(info.status == 1){
      document.getElementById('movieName').innerHTML = info.matchedInfo.title;
      if(info.matchedInfo.productionYear != undefined){
        document.getElementById('movieProductionYear').innerHTML = '(' + info.matchedInfo.productionYear + ')';
      }
      document.getElementById('movieTraktUrl').setAttribute('href','https://trakt.tv/movies/' + info.matchedInfo.traktId);
      displayWatchedStatus(info.matchedInfo.watched);
    }
    document.getElementById('manualMatchButton').style.display = 'block';
  }
  //If status is unmatched or episode is missing
  if(info.status == 2 || info.status == 4){
    document.getElementById('movieWatchedWrapper').style.display = 'none';
    document.getElementById('progressWrapper').style.display = 'none';
    document.getElementById('progressHeading').style.display = 'none';
    document.getElementById('seriesWatchedWrapper').style.display = 'none';
    document.getElementById('traktId').style.display = 'block';
    document.getElementById('traktId').innerHTML = 'Item not found...';
    if(info.status == 2){
      document.getElementById('manualMatchButton').style.display = 'none';
      document.getElementById('addShow').style.display = 'block';
      document.getElementById('addMovie').style.display = 'block';
    }
  }
  else if(info.status == 1){
    document.getElementById('traktId').innerHTML = 'Trakt id: ' + info.matchedInfo.traktId;
    document.getElementById('traktId').style.display = 'block';
  }
}

// Once the DOM is ready...
window.addEventListener('DOMContentLoaded', function () {
  // ...query for the active tab...
  queryActiveTabForInfo();
});

function navigateToNextEpisode(){
  if(infoBuffer.matchedInfo.nextUpURL != undefined){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      var tab = tabs[0];
      chrome.tabs.update(tab.id, {url: infoBuffer.matchedInfo.nextUpURL});
    });
  }
}

function matchManually(){
  hideAll();
  populateSearchList();
  document.getElementById('manualMatchContainer').style.display = 'block';
  document.getElementById('manualMatchButton').style.display = 'none';
}

function populateSearchList(){
  var list = document.getElementById('searchResultList');
  //Clearing list
  list.innerHTML = '';
  if(infoBuffer != undefined && infoBuffer.matchedInfo.searchResponse != undefined){
    for(var item of infoBuffer.matchedInfo.searchResponse){
      var li = document.createElement('li');
      //If episode. Search results will be show
      if(infoBuffer.scrapedInfo.type == 2){
        li.innerHTML = item.show.title;
        li.setAttribute('value',item.show.ids.trakt);
        li.addEventListener('click',setShowID);
      }
      //If movie
      else if(infoBuffer.scrapedInfo.type == 3){
        li.innerHTML = item.movie.title + '(' + item.movie.year + ')';
        li.setAttribute('value',item.movie.ids.trakt);
        li.addEventListener('click',setMovieID);
      }
      list.appendChild(li);
    }
  }
}

function queryActiveTabForInfo(){
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
    // ...and send a request for the DOM info...
    chrome.tabs.sendMessage(
        tabs[0].id,
        {from: 'popup', subject: 'getContentInfo'},
        // ...also specifying a callback to be called 
        //    from the receiving end (content script)
        displayContentInfo);
  });
}


// Listen for updates from content script
chrome.runtime.onMessage.addListener(function (msg, sender, response) {
  if ((msg.from === 'content') && (msg.subject === 'update')) {
    //If something has updated, get info and refresh display
    queryActiveTabForInfo();
  }
});

function setShowID(){
  //Set status loading and refresh popup
  infoBuffer.status = 0;
  var showId = this.getAttribute('value');
  displayContentInfo(infoBuffer);
    chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    {from: 'popup', 
    subject: 'setShowID',
    id: showId
  })});
}

function setMovieID(){
  //Set status loading and refresh popup
  infoBuffer.status = 0;
  var movieId = this.getAttribute('value');
  displayContentInfo(infoBuffer);
    chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    {from: 'popup', 
    subject: 'setMovieID',
    id: movieId
    })});
}