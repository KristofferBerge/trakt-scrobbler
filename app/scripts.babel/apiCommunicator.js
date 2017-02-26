'use strict';
//Variables scrapedItem and matchedContent are made available by manifest.json

//Caching access token for later use
var accessToken;
chrome.storage.sync.get(['traktToken'], 
    function(items){
        if(items['traktToken'] != undefined){             
            accessToken = items['traktToken'];
        }
    });

function setRequestHeaders(request,includeAuthorization = false){
    request.setRequestHeader('Content-Type', 'application/json');
    request.setRequestHeader('trakt-api-version', 2);
    request.setRequestHeader('trakt-api-key', '73fa81f2b8eb248acf687066f0918a999b78e926e501930ab22ad72173978fe9');
    if(includeAuthorization)
        request.setRequestHeader('Authorization', 'Bearer ' + accessToken);
}
//If response from api is unauthorized, log out to force new token to be retrieved
function handleUnauthorizedResponse(){
    chrome.storage.sync.clear(function(){
        console.error('Cannot autorize against trakt api. Logging out to force user to renew token');
        console.log('Chrome storage cleared');
    })
}

function submitWatchedEvent(progress,content){
    var req = new XMLHttpRequest();
    req.open('POST','https://api.trakt.tv/scrobble/stop');
    setRequestHeaders(req,true);
    console.warn(content);
    var body;
    if(content.type == 2){
      body = JSON.stringify({
        'episode': {
          'season': content.season,
          'number': content.episode,
          'title': content.title,
          'ids':{
            'trakt': content.episodeId
          }
        },
        'progress': progress
      });
    }
    else if(content.type == 3){
      body = JSON.stringify({
        'movie': {
          'title': content.title,
          'ids':{
            'trakt': content.traktId
          }
        },
        'progress': progress
      });
    }
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        //Created
        if(req.status == 201){
          console.log('Scrobble event successfully created');
          sendWatchedUpdateToContentScript(true);
        }
        //Conflict. Same scrobble was recently sent
        else if(req.status == 409){
          refreshPopup();          
          console.warn('Could not create scrobble event. An identical scrobble event for this tv show was recently saved.')
        }
        else if(req.status == 401){
          handleUnauthorizedResponse();
        }
        else{
          refreshPopup();          
          console.error('Scrobble could not be sent');
        }
      }
    }
    console.log(body);
    req.send(body);
    console.log('Scrobble sent');
}

function removeFromHistory(content){
    var req = new XMLHttpRequest();
    req.open('POST','https://api.trakt.tv/sync/history/remove');
    setRequestHeaders(req,true);
    var body;
    if(content.type == 2){
      body = JSON.stringify({
        'episodes': [
          {
            'season': content.season,
            'number': content.episode,
            'title': content.title,
            'ids':{
              'trakt': content.episodeId
            }
          }
        ]
      });
    }
    else if(content.type == 3){
      body = JSON.stringify({
        'movies': [
          {
            'title': content.title,
            'ids':{
              'trakt': content.traktId
            }
          }
        ]
      });
    }
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        if(req.status == 200){
          console.log('Item successfully removed from scrobble history.');
          sendWatchedUpdateToContentScript(false);
        }
        else if(req.status == 401){
          handleUnauthorizedResponse();
        }
        else{
          refreshPopup();
          console.error('Could not remove from history.');
        }
      }
    }
    req.send(body);
    console.log('Remove from history request sent');
}

function findItem(callback){
    //Select originalTitle if present. Normal title if not
    var title = scrapedItem.originalTitle != undefined?scrapedItem.originalTitle:scrapedItem.title;
    var type;
    if(scrapedItem.type == 3)
        type = 'movie';
    else if(scrapedItem.type == 2)
        type = 'show';
    else{
        console.error('Item type is unknown. Searching is pointless.');
        return;
    }
    var req = new XMLHttpRequest();
    req.open('GET','https://api.trakt.tv/search/' + type + '?query='+ title);
    setRequestHeaders(req);
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        if(req.status == 200){
          var response = JSON.parse(req.responseText);
          callback(response);
        }
        else if(req.status == 401){
          handleUnauthorizedResponse();
        }
        else{
            console.error('Item search failed');
        }
      }
    }
    req.send();
}

function getEpisode(callback){
    var req = new XMLHttpRequest();
    req.open('GET','https://api.trakt.tv/shows/' + matchedContent.traktId + '/seasons/' + scrapedItem.season + '/episodes/' + scrapedItem.episode);
    setRequestHeaders(req);
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        if(req.status == 200){
          var response = JSON.parse(req.responseText);
          callback(response);
        }
        else if(req.status == 401){
          handleUnauthorizedResponse();
        }
        else{
            console.error('Could not get episode');
            callback(null);
        }
      }
    }
    req.send();
}

function getShowWatchedStatus(callback){
    var req = new XMLHttpRequest();
    req.open('GET','https://api.trakt.tv/shows/'+ matchedContent.traktId + '/progress/watched?hidden=false&specials=false&count_specials=false');
    setRequestHeaders(req,true);
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        if(req.status == 200){
          var response = JSON.parse(req.responseText);
          callback(response);
        }
        else if(req.status == 401){
          loghandleUnauthorizedResponseOut();
        }
        else{
            console.error('Could not get watched status for show');
            callback(null);
        }
      }
    }
    req.send();
}
function getMovieWatchedStatus(callback){
    var req = new XMLHttpRequest();
    req.open('GET','https://api.trakt.tv/sync/history/movies/'+ matchedContent.traktId);
    setRequestHeaders(req,true);
    req.onreadystatechange = function(){
      if(req.readyState == 4){
        if(req.status == 200){
          var response = JSON.parse(req.responseText);
          callback(response);
        }
        else if(req.status == 401){
          handleUnauthorizedResponse();
        }
        else{
            console.error('Could not get watched status for movie');
        }
      }
    }
    req.send();
}

//Send message to content script and inform that watched status has been updated
function sendWatchedUpdateToContentScript(watched){
  //Method is run in content-script context. Trigger method directly
  if(chrome.tabs == undefined){
    updateWatchedStatus(watched);
  }
  //Method is run in popup context. Query for active tab
  else{
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function (tabs) {
      chrome.tabs.sendMessage(
          tabs[0].id,
          {from: 'apiCommunicator', subject: 'updateWatchedStatus', status: watched});
    });
  }
}

function refreshPopup(){
  //If method is trigged by content-script context. No use in refreshing popup
  if(chrome.tabs != undefined){
    chrome.runtime.sendMessage({
    from:    'content',
    subject: 'update',
    });
  }
}