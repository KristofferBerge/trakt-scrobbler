'use strict';
//Variables scrapedItem and matchedContent are made available by manifest.json

var interval;

////////////////////////////
// Trigged by common script
////////////////////////////

function scrape(){
    scrapedItem.type = getContentType();
    //If content is episode
    if(scrapedItem.type == 2){
        console.log('Content is episode.');        
        scrapedItem.title = getMetaContentByName('seriestitle');
        scrapedItem.episode = getMetaContentByName('episodenumber');
        scrapedItem.season = getSeasonNumber();
    }
    else if(scrapedItem.type == 3){
        console.log('Content is movie.');
        scrapedItem.title = getMetaContentByName('title');

        //Trying to find original title to use that instead
        scrapedItem.originalTitle = getOriginalTitle();
        scrapedItem.productionYear = getProductionYear();
    }
    else{
        console.log('Specific content not detected or unknown content type');
        return false;
    }
    //Done scraping initial info. Return true to let common script know info is ready
    return true;
}

function listenForScrobbleEvents(){
    console.log('Injecting code to listen for play event');
    var injectedCode = [
                  'var hasReachedNinetyFive = document.createElement("span");',
                  'hasReachedNinetyFive.setAttribute("id","hasReachedNinetyFive");',
                  'hasReachedNinetyFive.innerHTML = "false";',                  
                  'document.getElementsByTagName("body")[0].appendChild(hasReachedNinetyFive);',
                  '$.subscribe(nrk.msg.playerNinetyFivePercent,function(){document.getElementById("hasReachedNinetyFive").innerHTML = true;});'
                  ].join('\n');
    var script = document.createElement('script');
    script.textContent = injectedCode;
    (document.head||document.documentElement).appendChild(script);
    script.remove();
    interval = setInterval(checkForWatchedEvent,1000);
}


///////////////////////////
// Site specific code
//////////////////////////

//Finding type of content on nrk page
function getContentType(){
    var metaTags = document.getElementsByName('type');
    if(metaTags[0] == undefined){
        return ContentType.none;
    }
    var type = metaTags[0].getAttribute('content');
    switch(type){
        case 'episode':
            return ContentType.episode;
        case 'program':
            return ContentType.movie;
        default:
            return ContentType.none;
    }
}
//Getting info from meta-tags by name-attribute on nrk page
function getMetaContentByName(name){
    var metaTags = document.getElementsByName(name);
    return metaTags[0].getAttribute('content');
}

//Searching for a season number
function getSeasonNumber(){
    //No season number available on series. 
    //Must parse from season title by finding corresponding menu item for seasonid
    var seasonid = getMetaContentByName('seasonid');
    var menuItems = document.getElementsByClassName('season-link');
    for(let item of menuItems){
        if(item.getAttribute('data-season') == seasonid){
            var menuItemText = item.innerHTML;
            console.log(menuItemText);
            //if text is like "Alle episoder". Probably just one season
            if(menuItemText == 'Alle episoder')
                return 1;
            //If text is like "Sesong 1"
            return menuItemText.split(' ')[1];
        }
    }
}
function getOriginalTitle(){
    var infoSections = document.getElementsByClassName('infolist');
    for(var section of infoSections){
        for(var e in section.children){
            //Ensuring that index is a number and not some other property
            if(e > -1 && e < section.children.length){
                //Check if the element contains something that looks like an original title
                if(section.children[e].innerHTML.includes('Originaltittel')){
                    return section.children[parseInt(e)+1].innerHTML;
                }
            }
        }
    }
    return undefined;
}
function getProductionYear(){
    var infoSections = document.getElementsByClassName('infolist');
    for(var section of infoSections){
        for(var e in section.children){
            //Ensuring that index is a number and not some other property
            if(e > -1 && e < section.children.length){
                //Check if the element contains something that looks like an original title
                if(section.children[e].innerHTML.includes('Produksjons')){
                    return section.children[parseInt(e)+1].innerHTML;
                }
            }
        }
    }
    return undefined;
}
function checkForWatchedEvent(){
    var ninetyfive = document.getElementById('hasReachedNinetyFive').innerHTML;
    if (ninetyfive == 'true') {
        clearInterval(interval);
        setContentAsWatched(95);
    }
}