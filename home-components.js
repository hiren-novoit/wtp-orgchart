// http://api.jquery.com/map/#example-2
$.fn.equalizeHeights = function () {
    var maxHeight = this.map(function (i, e) {
        return $(e).height();
    }).get();
    return this.height(Math.max.apply(this, maxHeight));
};

// https://gist.github.com/hbogs/7908703
// window.location.origin polyfill for browsers that don't support location.origin
if (!window.location.origin) { // Some browsers (mainly IE) does not have this property, so we need to build it manually...
    window.location.origin = window.location.protocol + '//' + window.location.hostname + (window.location.port ? (':' + window.location.port) : '');
}

// Intranet Components -- global namespace to be shared with other similar files
window.IC = window.IC || {};

// Small utility - get new form digest
// Definitely some weirdness going on with SharePoint Online that this is required
IC.GetFormDigest = function () {
    return $.ajax({
        url: _spPageContextInfo.webAbsoluteUrl + "/_api/contextinfo",
        method: "POST",
        headers: {
            "Accept": "application/json; odata=verbose"
        }
    });
};

IC.LoadStyleSheet = function (url) {
    // we have jQuery!
    $('head').append('<link href="' + url + '" rel="stylesheet" />');
}

// LOAD STYLES
IC.LoadStyleSheet(_spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/coverflow/css/style.css?v=0.3');

/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Announcements / In Focus
/* ========================================================== */

IC.AnnouncementsInFocus = (function () {
    var _p = {};
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_announcementsinfocus';
    _p.configCacheKey = _spPageContextInfo.siteId + 'ic_announcementsinfocusconfig';

    _p.flktyImageSliders = [];

    var keys = {};
    keys.ItemLimit = 'Item Limit';
    keys.InFocusAutoplay = 'In Focus Autoplay';
    keys.InFocusAutoplaySpeed = 'In Focus Autoplay Speed';
    keys.InFocusImageAutoplay = 'In Focus Image Autoplay';
    keys.InFocusImageAutoplaySpeed = 'In Focus Image Autoplay Speed';

    // Set config defaults
    _p.CONFIG = [];
    _p.CONFIG[keys.ItemLimit] = '10';
    _p.CONFIG[keys.InFocusAutoplay] = 'FALSE';
    _p.CONFIG[keys.InFocusAutoplaySpeed] = '10000';
    _p.CONFIG[keys.InFocusImageAutoplay] = 'TRUE';
    _p.CONFIG[keys.InFocusImageAutoplaySpeed] = '8000';

    // Parse boolean
    _p.parseBoolean = function (b) {
        if (typeof (b) === 'boolean') return b;
        if (typeof (b) === 'undefined' || b === null) return false;
        return b.toLowerCase() === 'true';
    }

    // Load config from cache / SharePoint
    _p.loadConfig = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.configCacheKey);

        // data == null --> cache miss!
        // request data from server again
        if (data == null) {
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('In Focus Configuration')/items?$select=Title,ifc_value",
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-Request-Digest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    parseConfig(d.value);
                    var json = JSON.stringify(d.value);
                    locache.set(_p.configCacheKey, json, 60 * 60); // cache for 60 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            var d = JSON.parse(data);
            parseConfig(d);
            def.resolve(d);
        }

        return def.promise();

        // Define function after return statement. On compilation the function will be hoisted to the top of this function.
        function parseConfig(data) {
            data.forEach(function (item) {
                _p.CONFIG[item.Title] = item.ifc_value;
            });
        }
    }

    // Get data from SharePoint REST API // or from cache
    _p.getData = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.cacheKey);

        // Default to 10 announcements in focus
        var top = 10;
        try {
            top = parseInt(_p.CONFIG[keys.ItemLimit]);
        }
        catch (ex) {
            // gulp - catch exception
        }

        if (data == null) {
            // cache miss!
            // request data from server again
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('In Focus')/items?$select=ID,Title,an_images,an_preview,an_publishdate,an_keepreading&$orderby=an_publishdate desc&$top=" + top,
                headers: {
                    'Accept': 'application/json; odata=nometadata', // using nometadata as metadata isn't needed for this request. Bonus, request time and size is reduced!
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    var json = JSON.stringify(d.value);
                    locache.set(_p.cacheKey, json, 15 * 60); // cache for 15 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            def.resolve(JSON.parse(data));
        }

        return def.promise();
    }

    // Build carousel
    _p.buildCarousel = function (data) {
        // get our carousel element
        var $carousel = $('.in-focus-carousel');

        // loop through each data entry and build slides
        var count = 0;
        data.forEach(function (item) {
            $carousel.append(_p.buildSlide(item));
        });

        var inFocusOptions = _p.getInFocusFlickityOptions();
        var inFocusImageOptions = _p.getInFocusImageFlickityOptions();

        // initialise flickity slider
        var slider = new Flickity('.in-focus-carousel', inFocusOptions);

        // Initialise all inner-sliders
        $carousel.find('.image-carousel').each(function (idx) {
            var flkty = new Flickity(this, inFocusImageOptions);
            flkty.resize();
            _p.flktyImageSliders.push(flkty);
            $(this).css({ 'opacity': '1' });
        });

        // After-build actions
        slider.resize();

        $(window).on('resize', _p.flickityOnResize);
        $(window).on('load', _p.flickityOnResize);
        _p.flickityOnResize();

        // Fade in slider
        $carousel.animate({ 'opacity': '1' });

    }

    // Build individual slide for carousel
    _p.buildSlide = function (item) {

        // Get keep reading link
        var keepReading = '';
        if (typeof (item['an_keepreading']) !== 'undefined' && item['an_keepreading'] !== null) {
            keepReading = item['an_keepreading'].Url;
        }

        var $slide = $('<div class="carousel-cell"></div>');

        // build announcement panel
        var $an = $('<div class="announcement"></div>');
        $an.append('<h2><em>' + item.Title + '</em></h2>');
        $an.append('<p>' + item['an_preview'] + '</p>');
        if (keepReading != '') {
            $an.append('<p><a href="' + keepReading + '" class="wtp-btn">KEEP READING</a></p>');
        } else {
            $an.append('<p></p>');
        }

        // build additional image carousel
        var $imageCarousel = _p.buildImageCarousel(item);

        // append items to slide
        $slide.append($imageCarousel);
        $slide.append($an);

        return $slide;
    }

    // Build image carousel
    _p.buildImageCarousel = function (data) {
        var $carousel = $('<div class="carousel image-carousel"></div>');

        var html = data.an_images;
        if (typeof (html) !== 'undefined' && html !== null && html !== '') {
            $html = $(html);
            $html.find('img').each(function (idx) {
                $carousel.append(_p.buildImageSlide(this));
            });
        }

        return $carousel;
    }

    // Build an individual image slide
    _p.buildImageSlide = function (item) {
        //var $item = $(item);
        var $slide = $('<div class="carousel-cell"></div>');
        $slide.append('<div class="slide-image" style="background-image:url(\'' + item.src + '\');"></div>');
        return $slide;
    }

    // Get In Focus Options
    _p.getInFocusFlickityOptions = function () {
        var options = {
            imagesLoaded: true,
            wrapAround: true,
            draggable: false,
            prevNextButtons: true,
            pageDots: true
        }

        if (_p.parseBoolean(_p.CONFIG[keys.InFocusAutoplay])) {
            var autoPlaySpeed = 16000; // default
            try {
                autoPlaySpeed = parseInt(_p.CONFIG[keys.InFocusAutoplaySpeed]);
            }
            catch (ex) {
                // gulp, swallow exception
            }
            options.autoPlay = autoPlaySpeed;
        }

        return options;
    }

    // Get In Focus Image Flickity Options
    _p.getInFocusImageFlickityOptions = function () {
        var options = {
            imagesLoaded: true,
            wrapAround: true,
            draggable: true,
            prevNextButtons: false,
            pageDots: true
        };

        if (_p.parseBoolean(_p.CONFIG[keys.InFocusImageAutoplay])) {
            var autoPlaySpeed = 8000; // default
            try {
                autoPlaySpeed = parseInt(_p.CONFIG[keys.InFocusImageAutoplaySpeed]);
            }
            catch (ex) {
                // gulp, swallow exception
            }
            options.autoPlay = autoPlaySpeed;
        }

        return options;
    }

    // Flickity on resize
    _p.flickityOnResize = _.throttle(function (e) {
        // Timeout is used to handle maximise / restore
        setTimeout(function () {
            // resize image carousels ^^
            $('.in-focus-carousel .image-carousel').each(function (idx) {
                $(this).find('.slide-image').css('height', $(this).height() + 'px');
            });

            _p.flktyImageSliders.forEach(function (imageSlider) {
                imageSlider.resize();
            });
        }, 100);
    }, 100);

    _p.onError = function () {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(this, arguments);
        }
    }

    function init() {
        _p.loadConfig()
            .then(_p.getData, _p.onError)
            .then(_p.buildCarousel, _p.onError)
    }

    return {
        init: init
    }
})();


/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// What's on in (wherever) -- Calendar data source
/* ========================================================== */

IC.WhatsOn = (function () {
    var _p = {};
    _p.whatsOnListId = null;
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_whatson_v20170413';
    _p.serverTimeZoneInfo = null;

    _p.getTimeZoneInformation = function () {
        var def = $.Deferred();

        var get = $.ajax({
            url: _spPageContextInfo.siteAbsoluteUrl + "/_api/Web/RegionalSettings/TimeZone",
            headers: {
                'Accept': 'application/json; odata=nometadata',
                'X-RequestDigest': $('#__REQUESTDIGEST').val()
            }
        });

        get.done(function (data) {
            _p.serverTimeZoneInfo = data.Information;
        })

        get.fail(function (error) {
            def.reject();
        })

        return def.promise();
    }

    // Add local timezone stamp to string
    _p.addLocalTimezoneOffset = function (eventDate) {
        // Get timezone offset and flip
        var tz = new Date().getTimezoneOffset() / -60;
        var sign = tz >= 0 ? '+' : '-';

        // We will add the correct timezone offset to the string from SharePoint
        // This will allow JS to interpret the date correctly
        // 2017-02-28T15:00:00 ==> 2017-02-28T15:00:00+11:00
        var tzStr = Math.abs(tz).toString();
        if (tzStr.length == 1) {
            tzStr = '0' + tzStr;
        }

        var tzMinStr = Math.abs(new Date().getTimezoneOffset()) % 60;
        tzMinStr = tzMinStr.toString();
        if (tzMinStr.length == 1) {
            tzMinStr = tzMinStr + '0';
        }

        eventDate = eventDate + sign + tzStr + ':' + tzMinStr;
        return eventDate;
    }

    // Add server timezone offset
    _p.addServerTimezoneOffset = function (eventDate) {
        var tzBias = _p.serverTimeZoneInfo.Bias;

        // Use moment.js and moment-timezone.js to detect Daylight Savings Time
        var eventDateMoment = new moment.tz(eventDate, 'Australia/Sydney'); // hardcoded unfortunately. Must change if SharePoint Regional settings change
        if (eventDateMoment.isDST()) {
            tzBias += _p.serverTimeZoneInfo.DaylightBias;
        }

        // Get timezone offset and flip
        var tz = tzBias / -60;
        var sign = tz >= 0 ? '+' : '-';

        // We will add the correct timezone offset to the string from SharePoint
        // This will allow JS to interpret the date correctly
        // 2017-02-28T15:00:00 ==> 2017-02-28T15:00:00+11:00
        var tzStr = Math.abs(tz).toString();
        if (tzStr.length == 1) {
            tzStr = '0' + tzStr;
        }

        var tzMinStr = Math.abs(tzBias) % 60;
        tzMinStr = tzMinStr.toString();
        if (tzMinStr.length == 1) {
            tzMinStr = tzMinStr + '0';
        }

        // 2017-02-27 14:00:00 --> 2017-02-27 14:00:00+10:00
        eventDate = eventDate + sign + tzStr + ':' + tzMinStr;

        // 2017-02-27 14:00:00+10:00 --> 2017-02-27T14:00:00
        eventDate = eventDate.split(' ').join('T');

        return eventDate;
    }

    // Events have an Event Date served as Australia/Sydney time
    // We need to interpret these dates based on the Location of the office of the event,
    // And display the event in the users current local time. Here we go!
    _p.getLocalTimeOfEvent = function (item) {
        var eventDate = item.EventDate;
        var eventTz = OfficeLocations.National.tz; // default to national
        var localTz = moment.tz.guess(); // default to a guess by moment.timezone.js
        var currentUserLocation = 'National'; // default to national
        var currentUser = STAFFDIRECTORYDATA.getCurrentUser();

        // Try get event timezone
        try {
            eventTz = OfficeLocations[item.wo_officelocation].tz;
        } catch (ex) { /* gulp */ }
        
        // Try get current user office location
        if (currentUser !== null && currentUser.length > 0) {
            currentUserLocation = currentUser.adItem.Location;
        }

        // moment in event locations timezone
        var eventDateMoment = moment.tz(eventDate, eventTz);

        // convert to local timezone
        if (currentUserLocation !== 'National' && typeof (OfficeLocations[currentUserLocation]) !== 'undefined') {
            localTz = OfficeLocations[currentUserLocation].tz;
        }

        eventDateMoment.tz(localTz); // .tz mutates the current object

        // return moment timezone object
        return eventDateMoment;
    }

    // Quick format time to h:MM<am/pm> given a date object or date string with correct timezone information
    _p.quickFormatTime = function (eventDate) {
        // Add a timezone offset to the string to display in local time
        // eventDate = _p.addLocalTimezoneOffset(eventDate);

        // Create date object
        var date = new Date(eventDate);

        // Get hours
        var hours = date.getHours();

        // Get minutes, pad if necessary
        var minutes = '' + date.getMinutes(); // force string to enable length comparison later
        if (minutes.length == 1) {
            minutes = '0' + minutes;
        }

        // Get period
        var ampm = 'am';
        // post meridiem, 12 and after
        if (hours >= 12) {
            ampm = 'pm';
            if (hours >= 13) { // 13pm --> 1pm, 14pm --> 2pm etc.
                hours -= 12;
            }
        }
        else if (hours == 0) { // 0am --> 12am
            hours = 12;
        }

        return hours + ':' + minutes + ampm;
    }

    _p.getData = function () {
        var def = $.Deferred();

        var woData = locache.get(_p.cacheKey);
        if (woData !== null) {
            def.resolve(JSON.parse(woData));
        }
        else {
            // Get calendar list id
            var getCalendar = $.ajax({
                url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('Whats On')?$select=Id",
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            });

            getCalendar.done(function (listData) {
                _p.whatsOnListId = listData.Id; // set scope variable

                // Get items from lists.asmx web service. Deprecated. But it's the only one that expands recurring events
                var getItems = _p.GetItemsFromCalendarAsmx(_spPageContextInfo.siteAbsoluteUrl, listData.Id);

                getItems.done(function (listItems) {
                    var data = { d: { results: listItems } }; // emulate REST API response
                    locache.set(_p.cacheKey, JSON.stringify(data), 15 * 60); // cache for 15 minutes
                    def.resolve(data);
                });

                getItems.fail(_p.onError);
            })

            getCalendar.fail(_p.onError);
        }

        return def.promise();
    }

    // Adapted from https://gist.github.com/MartinBodocky/7984439 
    // What a legend.
    _p.GetItemsFromCalendarAsmx = function (webUrl, calendarGuid) {
        var def = $.Deferred();

        if (webUrl[webUrl.length - 1] !== '/') {
            webUrl = webUrl + '/';
        }

        wsURL = webUrl + "_vti_bin/Lists.asmx";

        var xmlCall =
            "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'> <soap:Body>" +
            "<GetListItems xmlns='http://schemas.microsoft.com/sharepoint/soap/'>" +
                "<listName>" + calendarGuid + "</listName>" +
                "<query>" +
                    "<Query>" +
                        "<Where>" +
                           "<DateRangesOverlap>" +
                               "<FieldRef Name=\"EventDate\" />" +
                               "<FieldRef Name=\"EndDate\" />" +
                               "<FieldRef Name=\"RecurrenceID\" />" +
                               "<Value Type='DateTime'><Year/></Value>" +
                           "</DateRangesOverlap>" +
                        "</Where>" +
                    "</Query>" +
                "</query>" +
                "<viewFields>" +
                    "<ViewFields>" +
                        "<FieldRef Name='ID'/>" +
                        "<FieldRef Name='EventDate'/>" +
                        "<FieldRef Name='EndDate'/>" +
                        "<FieldRef Name='Location'/>" +
                        "<FieldRef Name='Description'/>" +
                        "<FieldRef Name='wo_officelocation'/>" +
                        "<FieldRef Name='RecurrenceID'/>" +
                        "<FieldRef Name='fRecurrence'/>" +
                        "<FieldRef Name='UniqueId'/>" +
                    "</ViewFields>" +
                "</viewFields>" +
                 "<rowLimit>4999</rowLimit>" +
                "<queryOptions>" +
                    "<QueryOptions>" +
                        "<ExpandRecurrence>TRUE</ExpandRecurrence>" +
                    "</QueryOptions>" +
                "</queryOptions>" +
            "</GetListItems>" +
            "</soap:Body></soap:Envelope>";

        var get = $.ajax({
            url: wsURL,
            type: "POST",
            dataType: "xml",
            async: true,
            data: xmlCall,
            contentType: "text/xml; charset=\"utf-8\""
        })

        get.done(function (xData) {
            // We use jQuery to parse the XML response. Handy af.
            var root = $(xData);
            var result = [];

            // The XML response uses namespaced XML elements. Using children() is
            // an easy way to access these elements for data processing
            root.find("listitems").children().children().each(function () {
                var $this = $(this);
                var ids = $this.attr("ows_UniqueId").split(";");
                var rec = $this.attr("ows_fRecurrence");
                var allDay = $this.attr("ows_fAllDayEvent") === "1";

                var obj = {
                    "EventDate": $this.attr("ows_EventDate"),
                    "EndDate": $this.attr("ows_EndDate"),
                    "Title": $this.attr("ows_Title"),
                    "Recurrence": (rec === "1" ? true : false),
                    "Guid": ids[1],
                    "Id": ids[0],
                    "ID": ids[0],
                    "wo_officelocation": $this.attr("ows_wo_officelocation"),
                    "fAllDayEvent": allDay
                };

                // Use Regional Settings to convert EventDate to UTC+0
                obj["EventDateWithTZ"] = _p.addServerTimezoneOffset(obj.EventDate);

                result.push(obj);
            });

            def.resolve(result);
        });

        get.fail(function (err) {
            def.reject(err);
        });

        return def.promise();
    };

    // Apply location filter on dataset
    _p.applyLocationFilter = function (data) {
        if (data.d.results !== null && data.d.results.length > 0) {
            // Get current user from Staff Directory
            var currentUser = STAFFDIRECTORYDATA.getAllData().filter(function (u) {
                return u.Email.toLowerCase() == _spPageContextInfo.userEmail.toLowerCase()
            });

            // end here if current user not found in staff directory
            var location = '';
            if (currentUser.length > 0 && typeof (currentUser[0].adItem.Location) === 'string') {
                location = currentUser[0].adItem.Location.toLowerCase();
            }

            // Filter calendar events based on location
            data.d.results = data.d.results.filter(function (evt) {
                var evtLocation = evt.wo_officelocation.toLowerCase();
                return evtLocation === 'national' || location.indexOf(evtLocation) > -1 || location == '';
            });
        }

        return data;
    }

    // Get events on day
    _p.getEventsOnDay = function (events, date) {
        // zero out hours, minutes, seconds, milliseconds for easy comparisons
        var _date = new Date(date.getTime());
        _date.setHours(0, 0, 0, 0);

        return events.filter(function (evt) {
            var evtDate = new Date(evt.EventDateWithTZ);
            evtDate.setHours(0, 0, 0, 0);
            return evtDate.getTime() == _date.getTime();
        });
    }

    // Render
    _p.render = function (data) {
        function renderEvents(items) {
            var $frag = $('<div></div>');

            items.forEach(function (item) {
                var icsLink = _spPageContextInfo.webAbsoluteUrl + "/_vti_bin/owssvr.dll?CS=109&Cmd=Display&List={" + _p.whatsOnListId + "}&CacheControl=1&ID=" + item.Id + "&Using=Event.ics"
                var linkHtml = "<a href='" + icsLink + "'><img src='/_layouts/15/images/itevent.png' style='padding-right: 10px;'></a>";

                if (item.fAllDayEvent === true) {
                    $frag.append('<li>' + linkHtml + '<strong>All Day</strong> - ' + item.Title + '</li>');
                }
                else {
                    //var eventTime = _p.quickFormatTime(item); // old school - we have moment.js now!
                    var eventMoment = _p.getLocalTimeOfEvent(item);
                    $frag.append('<li>' + linkHtml + '<strong>' + eventMoment.format('h:mma') + '</strong> - ' + item.Title + '</li>');
                }
            });

            return $frag.children();
        }

        // Set link href
        $('.whatson-link').attr('href', _spPageContextInfo.siteAbsoluteUrl + "/lists/whats on/");

        if (data.d.results !== null && data.d.results.length > 0) {
            // Variables for comparison during filtering
            var today = new Date();
            var tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Todays events
            var todaysEvents = _p.getEventsOnDay(data.d.results, today);
            // Tomorrows events
            var tomorrowsEvents = _p.getEventsOnDay(data.d.results, tomorrow);

            // Any more dates and this will need to be refactored
            var $cbEvents = $('.chalkboard-events');
            var $todaysEvents = $('<ul class="chalkboard-eventlist"></ul>');
            var $tomorrowsEvents = $('<ul class="chalkboard-eventlist"></ul>');

            if (todaysEvents.length > 0) {
                $cbEvents.append('<h3>Today</h3>');
                $todaysEvents.append(renderEvents(todaysEvents));
                $cbEvents.append($todaysEvents);
            }

            if (tomorrowsEvents.length > 0) {
                $cbEvents.append('<h3>Tomorrow</h3>');
                $tomorrowsEvents.append(renderEvents(tomorrowsEvents));
                $cbEvents.append($tomorrowsEvents);
            }

            $('.chalkboard .scrollbar-outer').scrollbar();
        }

    }

    _p.onError = function (error) {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(error);
        }
    }

    function init() {
        STAFFDIRECTORYDATA.ensureSetup()
            .then(_p.getTimeZoneInformation(), _p.onError)
            .then(_p.getData, _p.onError)
            .then(_p.applyLocationFilter, _p.onError)
            .then(_p.render, _p.onError);
    }

    return {
        init: init
    }
})();


/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Hero Image Slider
/* ========================================================== */

IC.HeroImages = (function () {
    var _p = {};
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_heroimages';

    _p.getData = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.cacheKey);

        if (data == null) {
            // cache miss!
            // request data from server again
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Home Page Hero Images')/items?$select=hi_order,File&$expand=File&$orderby=hi_order",
                headers: {
                    'Accept': 'application/json; odata=nometadata', // using nometadata as metadata isn't needed for this request. Bonus, request time and size is reduced!
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    var json = JSON.stringify(d.value);
                    locache.set(_p.cacheKey, json, 15 * 60); // cache for 15 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            def.resolve(JSON.parse(data));
        }

        return def.promise();
    }

    _p.buildCarousel = function (data) {
        // get our carousel element
        var $carousel = $('.hero-carousel');

        // loop through each data entry and build slides
        data.forEach(function (item) {
            $carousel.append(_p.buildSlide(item));
        });

        // Set background image of carousel for better effect
        $carousel.css({ 'background-image': "url('" + data[0].File.ServerRelativeUrl + "')" });

        // initialise flickity slider
        var slider = new Flickity('.hero-carousel', {
            imagesLoaded: true,
            wrapAround: true,
            autoPlay: 8000,
            draggable: false,
            prevNextButtons: false,
            pageDots: false,
            setGallerySize: false
        });

        // After-build actions
        slider.resize();

        // Fade in carousel


        $carousel.imagesLoaded().progress(function () {

        }).always(function () {
            $carousel.animate({ 'opacity': '1' });
            $('.chalkboard-gradient').addClass('show');
        })

    }
    _p.buildSlide = function (item) {
        var $slide = $('<div class="carousel-cell"></div>');
        $slide.append('<div class="hero-image" style="background-image: url(\'' + item.File.ServerRelativeUrl + '\');"></div>');
        return $slide;
    }

    _p.onError = function () {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(this, arguments);
        }
    }

    function init() {
        _p.getData().then(_p.buildCarousel, _p.onError);
    }

    return {
        init: init
    }
})();

/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Hero Coverflow
/* ========================================================== */

IC.HeroCoverflow = (function () {
    var _p = {};
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_herocoverflow';
    _p.lzyElements = [];
    _p.observer = null;

    _p.getData = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.cacheKey);

        if (data == null) {
            // cache miss!
            // request data from server again
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Personal Staff Directory Photos')/items?$select=Title,File&$expand=File&$top=4999",
                headers: {
                    'Accept': 'application/json; odata=nometadata', // using nometadata as metadata isn't needed for this request. Bonus, request time and size is reduced!
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    var json = JSON.stringify(d.value);
                    locache.set(_p.cacheKey, json, 15 * 60); // cache for 15 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            def.resolve(JSON.parse(data));
        }

        return def.promise();
    }

    _p.buildCoverflow = function (data) {
        // get our coverflow element
        var $carousel = $('#coverflow');
        var $covers = $('<div class="covers"></div');
        var $controller = $('<div class="Controller"></div>');
        var $ul = $('<ul style="width: ' + (data.length * 300) + 'px"></ul>');

        // Hide carousel
        $carousel.css({ 'opacity': '0' });

        // loop through each data entry and build slides
        data.forEach(function (item) {
            $ul.append(_p.buildSlide(item));
        });

        $covers.append($ul);
        $carousel.append($covers);
        $carousel.append($controller);

        $carousel.imagesLoaded().always(function () {
            // Initialise coverflow
            var $coverflow = $("#coverflow").coverflow({ "path": _spPageContextInfo.siteAbsoluteUrl + "/style library/nit.intranet/js/coverflow/" });

            // Observe mutations to lazy load
            IC.LazyLoader.init();

            // Fix missing classes! BUG
            var $li = $('#coverflow .covers li');
            var mid = Math.ceil($li.length / 2);

            // All slides to the LEFT of the middle
            $li.slice(0, mid - 1).addClass('leftLI');
            $li.slice(0, mid - 1).each(function (idx) {
                $(this).find('.imgdiv').addClass('leftItems');
            })

            // All slides to the RIGHT of the middle
            $li.slice(mid).addClass('rightLI');
            $li.slice(mid).each(function (idx) {
                $(this).find('.imgdiv').addClass('rightItems');
            })

            // The middle slide
            $($li[mid - 1]).addClass('straightLI');
            $($li[mid - 1]).find('.imgdiv').addClass('straight');

            // Show carousel
            $carousel.animate({ 'opacity': '1' });

            // Start autoplay
            IC.CoverflowAutoplayer.start();
        });

    }

    _p.buildSlide = function (item) {
        // Get Staff Directory Profile link
        var profileLink = _p.getProfileLink(item);
        var $slide = $('<li data-src="' + item.File.ServerRelativeUrl + '?RenditionID=5&_=20170301"></li>'); // https://wtpaustraliaptyltd.sharepoint.com/sites/intranetpt/Style%20Library/NIT.Intranet/img/profile-placeholder.png
        // var $img = $('<div class="imgdiv"><a href="' + profileLink + '"><img src="' + item.File.ServerRelativeUrl + '?RenditionID=5" alt="" /></a></div>');
        var $img = $('<div class="imgdiv"><a href="' + profileLink + '"><img class="placeholder" src="' + _spPageContextInfo.siteAbsoluteUrl + '/Style%20Library/NIT.Intranet/img/profile-placeholder-dark.png?RenditionID=5&_=20170301" alt="" /></a></div>');
        if (typeof (item.Title) === 'string' && item.Title.trim() !== '') {
            var $text = $('<div class="text"><p>' + item.Title + '</p></div>');
        }
        $slide.append($img);
        $slide.append($text);
        return $slide;
    }

    _p.getProfileLink = function (item) {
        var profileBase = _spPageContextInfo.siteAbsoluteUrl + '/pages/staff-directory.aspx?userkey=';
        // /sites/intranetpt/Staff Directory Photo Cache/gfitzpatrick@wtpartnership.com.au.jpg?RenditionID=5
        var parts = item.File.ServerRelativeUrl.split('/');
        var fileParts = parts[parts.length - 1].split('.');
        if (fileParts.length == 1) return (profileBase + fileParts[0]);
        return (profileBase + fileParts.slice(0, fileParts.length - 1).join('.'));
    }

    _p.onError = function () {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(this, arguments);
        }
    }

    function init() {
        _p.getData().then(_p.buildCoverflow, _p.onError);
    }

    return {
        init: init
    }
})();

IC.LazyLoader = (function () {
    var _p = {};
    _p.observer = null;
    _p.elements = null;
    _p.initialised = false;

    _p.createObserver = function () {
        return new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                // console.log(mutation.type, mutation);
                if (mutation.attributeName == 'class') {
                    var $e = $(mutation.target);
                    if ($e.hasClass('straightLI')) {
                        var el = _p.elements.filter(function (e) { return e === mutation.target; });

                        // Load in images +- 12- from here
                        var idx = _p.elements.indexOf(mutation.target);
                        var els = _p.elements.slice(Math.max(0, idx - 12), idx + 12);
                        els.forEach(function (elementToLoad) {
                            // if image hasn't been loaded in yet
                            var $elementToLoad = $(elementToLoad);
                            if ($elementToLoad.find('.loaded-image').length === 0) {
                                // LOAD IN!

                                var src = $elementToLoad.attr('data-src');
                                var aTag = $elementToLoad.find('a');
                                var oldImg = $("img", aTag);


                                aTag.prepend('<img src="' + src + '" class="loaded-image" style="opacity: 0; position: absolute;" />');

                                var refATag = $(".refl", aTag.parent());
                                var oldRefImg = $("img", refATag);
                                oldRefImg.remove();
                                refATag.append('<img src="' + src + '" />');

                                var timeoutWrapper = function ($elementToLoad, oldImg) {
                                    $elementToLoad.imagesLoaded().always(function () {
                                        // Fade in new image
                                        $elementToLoad.find('.loaded-image').fadeTo(300, 1);

                                        // Fade out placeholder
                                        oldImg.fadeTo(300, 0);
                                    });
                                }

                                timeoutWrapper($elementToLoad, oldImg);
                            }
                        })


                    }
                }
            });
        });
    }

    _p.observeElements = function () {
        _p.elements.forEach(function (element) {
            // configuration of the observer:
            var config = {
                attributes: true
            };

            // pass in the target node, as well as the observer options
            _p.observer.observe(element, config);
        })
    }

    function init() {
        if (!_p.initialised) {
            _p.initialised = true;

            // Create observer
            _p.observer = _p.createObserver();

            // Get elements
            _p.elements = Array.from(document.querySelectorAll('#coverflow li'));

            // Attach to all element
            _p.observeElements();
        }
    }

    return {
        init: init
    }
})();

IC.CoverflowAutoplayer = (function () {
    var _p = {};

    _p.direction = 'right';
    _p.currentSlide = null;
    _p.loopTimeout = -1;
    _p.slideTime = 4000;

    _p.bindEvents = function () {
        $('#coverflow').on('mousedown.ap mouseup.ap touchstart.ap touchend.ap dragstart.ap dragend.ap click.ap', _p.restartLoop);
        $('#coverflow li').on('mouseenter.ap', function (e) {
            if ($(this).hasClass('straightLI')) {
                _p.stopLoop();
            }
        }).on('mouseleave.ap', function (e) {
            if ($(this).hasClass('straightLI')) {
                _p.startLoop();
            }
        });
    }
    _p.unbindEvents = function () {
        $('#coverflow').off('mousedown.ap mouseup.ap touchstart.ap touchend.ap dragstart.ap dragend.ap click.ap');
        $('#coverflow li').off('mouseenter.ap mouseleave.ap');
    }

    _p.moveNext = function () {
        _p.chooseDirection();
        // check to make sure current cached slide hasn't changed
        // if it has, restart loop!
        if (_p.currentSlide.hasClass('straightLI')) {
            // check direction
            var sel = _p.direction === 'right' ? '#next' : '#prev';

            // disable coverflow if megamenu is showing
            if ($('.megamenu li.is-hover').length == 0) {
                $(sel).trigger('mousedown').trigger('mouseup');
            }
        }

        _p.getCurrentSlide();
        _p.restartLoop();
    }

    _p.chooseDirection = function () {
        if (_p.direction === 'right' && _p.currentSlide.next().length == 0) {
            _p.direction = 'left';
        }
        else if (_p.direction === 'left' && _p.currentSlide.prev().length == 0) {
            _p.direction = 'right';
        }
    }

    _p.getCurrentSlide = function () {
        _p.currentSlide = $('.straightLI');
    }

    _p.startLoop = function () {
        if (_p.loopTimeout === -1) {
            _p.loopTimeout = setTimeout(_p.moveNext, _p.slideTime);
        }
    }

    _p.stopLoop = function () {
        if (_p.loopTimeout !== -1) {
            clearTimeout(_p.loopTimeout);
            _p.loopTimeout = -1;
        }
    }

    _p.restartLoop = function () {
        _p.stopLoop();
        _p.startLoop();
    }


    function start() {
        _p.getCurrentSlide();
        _p.bindEvents();
        _p.startLoop();
    }

    function stop() {
        _p.unbindEvents();
        _p.stopLoop();
    }


    return {
        start: start,
        stop: stop
    }
})();

var TimeAgo = (function () {
    var _p = {};

    // Public Methods
    _p.locales = {
        prefix: '',
        sufix: 'ago',

        seconds: 'less than a minute',
        minute: 'about a minute',
        minutes: '%d minutes',
        hour: 'about an hour',
        hours: 'about %d hours',
        day: 'a day',
        days: '%d days',
        month: 'about a month',
        months: '%d months',
        year: 'about a year',
        years: '%d years'
    };

    _p.inWords = function (timeAgo) {
        var seconds = Math.floor((new Date() - parseInt(timeAgo)) / 1000),
            separator = this.locales.separator || ' ',
            words = this.locales.prefix + separator,
            interval = 0,
            intervals = {
                year: seconds / 31536000,
                month: seconds / 2592000,
                day: seconds / 86400,
                hour: seconds / 3600,
                minute: seconds / 60
            };

        var distance = this.locales.seconds;

        for (var key in intervals) {
            interval = Math.floor(intervals[key]);

            if (interval > 1) {
                distance = this.locales[key + 's'];
                break;
            } else if (interval === 1) {
                distance = this.locales[key];
                break;
            }
        }

        distance = distance.replace(/%d/i, interval);
        words += distance + separator + this.locales.sufix;

        return words.trim();
    };

    return {
        locales: _p.locales,
        inWords: _p.inWords
    };
}());


/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Yammer Integration
/* ========================================================== */

IC.YammerNewsfeed = (function () {
    var _p = {};
    _p.$flktyNewsfeed = null;
    _p.flktyNewsfeed = null;
    _p.flktyImageSliders = [];
    _p.messageCache = [];
    _p.messageIdCache = []; // hashmap for quick lookup
    _p.cacheKeyUpdated = false;
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_yammercache';
    _p.configCacheKey = _spPageContextInfo.siteId + 'ic_yammerconfigcache';
    _p.authTokenCacheKey = _spPageContextInfo.siteId + 'ic_yammerauthcache';
    _p.mdownThis = null;
    _p.mdownScreenX = -1;
    _p.mdownScreenY = -1;
    _p.mdownTolerance = 10;
    _p.CONFIG = [];

    var keys = {};
    keys.ItemLimit = 'Item Limit';
    keys.NewsfeedAutoplay = 'Newsfeed Autoplay';
    keys.NewsfeedAutoplaySpeed = 'Newsfeed Autoplay Speed';
    keys.NewsfeedImageAutoplay = 'Newsfeed Image Autoplay';
    keys.NewsfeedImageAutoplaySpeed = 'Newsfeed Image Autoplay Speed';
    keys.UserFilter = 'User Filter';
    keys.AutoRefresh = 'Auto Refresh';
    keys.AutoRefreshSpeed = 'Auto Refresh Speed';
    keys.FeedID = 'Feed ID';

    // Set config defaults
    _p.CONFIG[keys.ItemLimit] = '10';
    _p.CONFIG[keys.NewsfeedAutoplay] = 'FALSE';
    _p.CONFIG[keys.NewsfeedAutoplaySpeed] = '8000';
    _p.CONFIG[keys.NewsfeedImageAutoplay] = 'TRUE';
    _p.CONFIG[keys.NewsfeedImageAutoplaySpeed] = '16000';
    _p.CONFIG[keys.UserFilter] = 'Fred Smith';
    _p.CONFIG[keys.AutoRefresh] = 'TRUE';
    _p.CONFIG[keys.AutoRefreshSpeed] = '120000';
    _p.CONFIG[keys.FeedID] = '10507245';

    // Update CacheKey
    _p.updateCacheKeys = function () {
        if (!_p.cacheKeyUpdated) {
            _p.cacheKeyUpdated = true;

            var idAsString = _spPageContextInfo.userId.toString();

            _p.cacheKey += idAsString;
            _p.authTokenCacheKey += idAsString;
        }
    }

    // Update cached auth token
    _p.updateCachedAuthToken = function (authToken) {
        locache.set(_p.authTokenCacheKey, authToken);
    }

    // Get auth header
    _p.getAuthHeader = function () {
        return "Bearer " + locache.get(_p.authTokenCacheKey);
    }

    // Parse boolean
    _p.parseBoolean = function (b) {
        if (typeof (b) === 'boolean') return b;
        if (typeof (b) === 'undefined' || b === null) return false;
        return b.toLowerCase() === 'true';
    }

    // Load config from cache / SharePoint
    _p.loadConfig = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.configCacheKey);

        // data == null --> cache miss!
        // request data from server again
        if (data == null) {
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Yammer Configuration')/items?$select=Title,yc_value&_=" + new Date().getTime(),
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-Request-Digest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    parseConfig(d.value);
                    var json = JSON.stringify(d.value);
                    locache.set(_p.configCacheKey, json, 60 * 60); // cache for 60 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            var d = JSON.parse(data);
            parseConfig(d);
            def.resolve(d);
        }

        return def.promise();

        // Define function after return statement. On compilation the function will be hoisted to the top of this function.
        function parseConfig(data) {
            data.forEach(function (item) {
                _p.CONFIG[item.Title] = item.yc_value;
            });
        }
    }

    // Show Loading
    _p.showLoading = function () {
        var loadingHtml = '<div class="newsfeed-loading"><div class="spinner"></div></div>';

        $('.newsfeed').parent().append(loadingHtml);
    }

    // Hide Loading
    _p.hideLoading = function () {
        $('.newsfeed').parent().find('.newsfeed-loading').animate({
            'opacity': '0'
        }, {
            complete: function () {
                $(this).remove();
            }
        });
    }

    // Update message cache
    _p.updateMessageCache = function (messages) {
        messages.forEach(function (message) {
            _p.messageCache.push(message);
            _p.messageIdCache[message.id] = true;
        });
    }

    // Filter messages using the UserFilter option defined in the CONFIG
    _p.filterMessagesByUsers = function (messages) {
        // Get user id from CONFIG
        var userFilter = _p.CONFIG[keys.UserFilter].replace(/ /gi, '').split(',');

        // Only keep messages that are:
        // By a user contained in userFilter array
        // and is not already displayed on the page
        var msgs = messages.filter(function (message) {
            return userFilter.indexOf(message.sender_id.toString()) > -1;
        });

        return msgs;
    }

    // Filter out messages previously used 
    _p.filterMessagesByMessageId = function (messages) {
        var msgs = messages.filter(function (message) {
            return _p.messageIdCache[message.id] !== true;
        });

        return msgs;
    }

    // Apply item limit
    _p.filterMessagesByItemLimit = function (messages) {
        return messages.slice(0, parseInt(_p.CONFIG[keys.ItemLimit]));
    }

    // Build messages from data object retrieved from Yammer API
    _p.buildMessages = function (data) {
        // loop through each data entry and build slides
        data.messages.forEach(function (item, idx, messagesArray) {
            // Get the sender from the references array and add it
            for (var i = 0; i < data.references.length; i++) {
                if (data.references[i].id == item.sender_id) {
                    item.sender = data.references[i];
                }
            }

            // Get the topics from the thread reference
            for (var i = 0; i < data.references.length; i++) {
                if (data.references[i].id == item.id) {
                    var reference = data.references[i];
                    item.topics = [];

                    var topicsAdded = [];

                    // For each of the topics, get the full topic from the references
                    for (var x = 0; x < reference.topics.length; x++) {
                        var topicId = reference.topics[x].id;

                        for (var y = 0; y < data.references.length; y++) {
                            if (data.references[y].id == topicId && topicsAdded.indexOf(data.references[y].id) == -1) {
                                // Push the topic into the message object
                                item.topics.push(data.references[y]);
                                topicsAdded.push(data.references[y].id);
                            }
                        }
                    }
                }
            }

            // Loop through the liked_by names and add users for each
            for (var i = 0; i < item.liked_by.names.length; i++) {
                var like = item.liked_by.names[i];

                for (var i = 0; i < data.references.length; i++) {
                    if (data.references[i].id == like.user_id) {
                        like.user = data.references[i];
                    }
                }
            }

            item.currentUserId = data.meta.current_user_id;

            // Update item in array
            messagesArray[idx] = item;
        });

        return data;
    }

    // Open iFrame handler
    _p.openIFrameHandler = function (e) {
        // Cache $(this)
        var $this = $(this);

        // Get iframe src
        var src = $this.attr('data-ymodule-src');
        var title = $this.attr('data-ymodule-title');

        // If the src isn't empty, load in the modal scripts then open an iframe
        SP.SOD.executeFunc('sp.ui.dialog.js', 'SP.UI.ModalDialog.showModalDialog', function () {
            SP.UI.ModalDialog.showModalDialog({
                url: src,
                title: title,
                showClose: true
            });
        });
    }

    // Open image handler
    _p.openImageHandler = function (e) {
        // Cache $(this)
        var $this = $(this);

        // Get image src
        var src = $this.attr('data-ymodule-img');
        // src = 'https://www.yammer.com/api/v1/uploaded_files/93127914/version/9342775453/large_preview/Roads%20Aust%20-%20Diversity%20Leadership%20Forum%20-%20May%202017.jpg';
        var title = $this.attr('data-ymodule-title');
        var yammerLink = $this.closest('.carousel').next().children('a').attr('href');

        // Append a hidden div to body
        var $hiddenDiv = $('<div class="ms-hidden ymodule-iframe-img"></div>');
        $hiddenDiv.append('<p class="modal-imgerror" style="display: none;">The image failed to load. Please <a href="'+yammerLink+'" target="_blank">view the post on Yammer</a>. Alternatively, please open <a href="https://www.yammer.com/office365" target="_blank">Yammer</a> and then try again.</p>')
        $hiddenDiv.append('<img class="modal-yammerimg" src="' + src + '" style="max-width: 100%;" />');
        $hiddenDiv.append('<p class="modal-viewonyammer"><a href="'+yammerLink+'" target="_blank">Click here to view the post on Yammer</a></p>');
        $('.main-col').append($hiddenDiv);

        // Retrieve div in new variable, clone and then display in modal
        var $displayDiv = $('.ymodule-iframe-img:last');
        var dialogElement = $displayDiv.clone();
        dialogElement.removeClass('ms-hidden');
        dialogElement.css({
            'display': 'inline-block',
            'padding': '20px'
        });

        SP.SOD.executeFunc('sp.ui.dialog.js', 'SP.UI.ModalDialog.showModalDialog', function () {

            var modal = SP.UI.ModalDialog.showModalDialog({
                html: dialogElement[0],
                title: title,
                showClose: true
            });

            // on image load, resize modal!
            var $modal = $(modal.get_dialogElement());
            $modal.imagesLoaded().always(function (result) {
                if (result.hasAnyBroken) {
                    // hide image, display link to Yammer - get user to refresh Yammer login
                    $modal.find('.modal-imgerror').show();
                    $modal.find('.modal-yammerimg').hide();
                    $modal.find('.modal-viewonyammer').hide();
                }
                modal.autoSize();
            })
        })
    }

    // Flickity on resize
    _p.flickityOnResize = _.throttle(function (e) {
        // Timeout is used to handle maximise / restore
        setTimeout(function () {
            // resize image carousels ^^
            $('.newsfeed .image-carousel').each(function (idx) {
                $(this).find('.slide-image').css('height', $(this).height() + 'px');
            });

            _p.flktyImageSliders.forEach(function (imageSlider) {
                imageSlider.resize();
            });
        }, 100);
    }, 100);

    // Build carousel
    _p.buildCarousel = function (data) {
        _p.hideLoading();
        // get our carousel element
        var $carousel = $('.newsfeed');

        // Filter - we only want messages from a certain user
        data.messages = _p.filterMessagesByUsers(data.messages);

        // Update message cache
        _p.updateMessageCache(data.messages);

        // Reduce amount of items
        data.messages = _p.filterMessagesByItemLimit(data.messages);

        // Build message items
        data = _p.buildMessages(data);

        // loop through each data entry and build slides
        data.messages.forEach(function (item) {
            $carousel.append(_p.buildSlide(item));
        });

        // initialise flickity slider
        var newsfeedOptions = _p.getNewsfeedFlickityOptions();
        var newsfeedImageOptions = _p.getNewsfeedImageOptions();

        // Main newsfeed slider
        _p.$flktyNewsfeed = $carousel.flickity(newsfeedOptions);

        // Initialise all inner-sliders
        $carousel.find('.image-carousel').each(function (idx) {
            var flkty = new Flickity(this, newsfeedImageOptions);
            flkty.resize();
            _p.flktyImageSliders.push(flkty);
            $(this).css({ 'opacity': '1' });
        });

        // After-build actions
        _p.loadImageAttachments();
        _p.$flktyNewsfeed.flickity('resize');

        $(window).on('resize', _p.flickityOnResize);
        $(window).on('load', _p.flickityOnResize);
        _p.flickityOnResize();

        // Fade in slider
        $carousel.animate({ 'opacity': '1' });

        $('[data-ymodule-src], [data-ymodule-img]').on('mousedown', function (e) {
            if (e.which == 1) {
                // capture screen X and screen Y of mouse
                _p.mdownThis = this;
                _p.mdownScreenX = e.screenX;
                _p.mdownScreenY = e.screenY;

                // console.log('MOUSEDOWN', _p.mdownScreenX, _p.mdownScreenY);
            }
        });

        $('[data-ymodule-src], [data-ymodule-img]').on('mouseup', function (e) {
            if (e.which == 1) {
                // console.log('MOUSEUP', _p.mdownScreenX, _p.mdownScreenY, e.screenX, e.screenY);
                // was mousedown on this element ?
                // is screen X and screen Y within tolerance levels
                if (this === _p.mdownThis) {
                    if (Math.abs(_p.mdownScreenX - e.screenX + _p.mdownTolerance) < (_p.mdownTolerance * 2)
                        && Math.abs(_p.mdownScreenY - e.screenY + _p.mdownTolerance) < (_p.mdownTolerance * 2)) {
                        var $this = $(this);
                        typeof ($this.attr('data-ymodule-src')) !== 'undefined' && _p.openIFrameHandler.apply(this, arguments);
                        typeof ($this.attr('data-ymodule-img')) !== 'undefined' && _p.openImageHandler.apply(this, arguments);
                    }
                }
            }
        });

        // Auto refresh
        _p.autoRefresh();
    }

    // Get Newsfeed Flickity Options
    _p.getNewsfeedFlickityOptions = function () {
        var newsfeedOptions = {
            imagesLoaded: true,
            wrapAround: true,
            draggable: false,
            prevNextButtons: true,
            pageDots: true
        }

        if (_p.parseBoolean(_p.CONFIG[keys.NewsfeedAutoplay])) {
            var autoPlaySpeed = 16000; // default
            try {
                autoPlaySpeed = parseInt(_p.CONFIG[keys.NewsfeedAutoplaySpeed]);
            }
            catch (ex) {
                // gulp, swallow exception
                if (window.console) {
                    var log = console.error ? console.error : console.log;
                    log(ex);
                }
            }
            newsfeedOptions.autoPlay = autoPlaySpeed;
        }

        return newsfeedOptions;
    }

    // Get Newsfeed Image Flickity Options
    _p.getNewsfeedImageOptions = function () {
        var newsfeedImageOptions = {
            imagesLoaded: true,
            wrapAround: true,
            draggable: true,
            prevNextButtons: false,
            pageDots: true
        };

        if (_p.parseBoolean(_p.CONFIG[keys.NewsfeedImageAutoplay])) {
            var autoPlaySpeed = 8000; // default
            try {
                autoPlaySpeed = parseInt(_p.CONFIG[keys.NewsfeedImageAutoplaySpeed]);
            }
            catch (ex) {
                // gulp, swallow exception
                if (window.console) {
                    var log = console.error ? console.error : console.log;
                    log(ex);
                }
            }
            newsfeedImageOptions.autoPlay = autoPlaySpeed;
        }

        return newsfeedImageOptions;
    }

    // Calculate Details
    _p.calculateDetails = function (item, forceLikeByYou) {
        var timeAgo = TimeAgo.inWords(new Date(item.created_at).getTime());

        var topicsHtml = "";
        if (!(typeof item.topics === 'undefined')) {
            for (var i = 0; i < item.topics.length; i++) {
                var topic = item.topics[i];

                topicsHtml += "<a target='_blank' href='" + topic.web_url + "'>#" + topic.name + "</a>";
                topicsHtml += "&nbsp;&nbsp;";
            }
        }

        var likeCount = item.liked_by.count;
        var youLike = 0;
        if (forceLikeByYou) {
            youLike = 1;
        }

        var likesThisHtml = "";
        if ((likeCount + youLike) != 0) {
            likesThisHtml = (likeCount + youLike) + " like this"
        }

        return { TimeAgo: timeAgo, LikesThis: likesThisHtml, Topics: topicsHtml };
    }

    // Build individual slide for carousel
    _p.buildSlide = function (item) {
        var $slide = $('<div class="carousel-cell"></div>');
        var extendedDetails = _p.calculateDetails(item);

        // build announcement panel
        var $an = $('<div class="content"></div>');
        $an.append('<a target="_blank" href="' + item.web_url + '"><div class="view-yam-button">View on Yammer</div></a>');
        $an.append('<div class="small-yam-text">' + extendedDetails.TimeAgo + ' by ' + item.sender.full_name + '</div>');
        $an.append('<div class="body-yam-text">' + item.body.rich + '</div>');

        if (extendedDetails.Topics.length != 0) {
            $an.append('<div class="small-yam-text" style="margin-bottom: 0px;">' + extendedDetails.Topics + '</div>');
        }

        // Check if you have liked it already
        var likeText = "LIKE";
        for (var i = 0; i < item.liked_by.names.length; i++) {
            var userName = item.liked_by.names[i];
            if (userName.user_id == item.currentUserId) {
                likeText = "UNLIKE";
                break;
            }
        }

        $an.append('<ul class="like-and-reply">' +
				   '<li>  ' +
				   '	<a role="button" target="_blank" href="javascript://" title="like this message" class="like-button">' +
				   '		<span class="like-icon"><img src="' + _spPageContextInfo.siteAbsoluteUrl + '/Style Library/NIT.Intranet/img/thumbs-up-off.png" /></span>' +
				   '		<span aria-hidden="true" class="like-text">' + likeText + '</span>' +
				   '	</a>' +
				   '</li>' +
				   '  <li style="padding-left: 10px;">  ' +
				   '	<a role="button" target="_blank" href="' + item.web_url + '" title="reply to this message" class="reply-button">' +
				   '		<span class="reply-icon"><img src="' + _spPageContextInfo.siteAbsoluteUrl + '/Style Library/NIT.Intranet/img/reply-off.png" /></span>' +
				   '		<span aria-hidden="true">REPLY</span>' +
				   '	  </a>' +
				   '</li>' +
				   '</ul>');

        if (extendedDetails.LikesThis.length > 0) {
            $an.append('<div class="like-this">' + extendedDetails.LikesThis + '</div>');
        }

        $(".like-button", $an).click(function (event) {
            var currValue = $(".like-text", this).text();
            var that = this;

            var like = function () {
                $(".like-text", that).text("UNLIKE");
                item.liked_by.count++;
                $(".like-this", $an).html(_p.calculateDetails(item).LikesThis)
            }

            var unlike = function () {
                $(".like-text", that).text("LIKE");
                item.liked_by.count--;
                $(".like-this", $an).html(_p.calculateDetails(item).LikesThis)
            }

            if (currValue == "LIKE") {
                _p.likeYammer(item).done(function () {
                    like();
                }).fail(function () {
                    like();
                });
            } else {
                _p.unlikeYammer(item).done(function () {
                    unlike();
                }).fail(function () {
                    unlike();
                });
            }

            // BUG FIX: IE was following the HREF when like was clicked. 
            if (window.event) {
                window.event.returnValue = false;
            }
            event.preventDefault();
            return false;
        });

        // build additional aux carousel
        var $imageCarousel = _p.buildAuxCarousel(item);

        // append items to slide
        $slide.append($imageCarousel);
        $slide.append($an);

        return $slide;
    }

    // Build aux carousel
    _p.buildAuxCarousel = function (item) {
        var $carousel = $('<div class="carousel image-carousel"></div>');

        item.attachments.forEach(function (attachment) {
            var slide = null;
            if (attachment.type == 'image') {
                slide = _p.buildImageSlide(attachment);
            }
            else if (attachment.type == 'ymodule') {
                slide = _p.buildYModuleSlide(attachment);
            }
            else if (attachment.type == 'file') {
                slide = _p.buildYModuleSlide(attachment);
            }

            if (slide !== null) {
                $carousel.append(slide);
            }
        });

        return $carousel;
    }

    // Build an individual image slide
    _p.buildImageSlide = function (item) {
        var imgUrl = item.scaled_url.replace("{{width}}", "300").replace("{{height}}", "300");
        var $slide = $('<div class="carousel-cell"></div>');
        //var $image = $('<div class="slide-image" style="background-image:url(\'' + imgUrl + '\');" data-loadfromyammer="true" data-src="' + imgUrl + '"></div>');
        var $image = $('<div class="slide-image" data-loadfromyammer="true" data-src="' + imgUrl + '" data-yammerattachmentid="' + item.id + '"></div>');
        $image.attr('data-ymodule-img', item.large_preview_url);
        $image.attr('data-ymodule-title', _p.transformTitle(item.full_name));
        $slide.append($image);
        return $slide;
    }

    // Build an individual YModule slide -- handles file attachments as well
    _p.buildYModuleSlide = function (item) {
        // Detect video ...
        var isVideo = typeof (item.video_url) !== 'undefined';
        var isFile = item.type === 'file';
        var imgUrl = item.thumbnail_url;

        if (!isFile && imgUrl == null) { return null; }

        // try use the large icon url
        if (isFile && typeof (item.large_icon_url) === 'string') {
            imgUrl = item.large_icon_url;
        }

        var $slide = $('<div class="carousel-cell"></div>');
        var $a = $('<a href="' + item.web_url + '" target="_blank" rel="noopener" class="slide-ymodule" alt="' + item.name + '"></a>'); //  style="background-image: url(\'' + imgUrl + '\')"

        // Build image preview
        var $imgPreview = $('<div class="ymodule-imgpreview" style="background-image: url(\'' + imgUrl + '\')"></div>');
        $a.append($imgPreview);

        // Build link preview
        var $linkPreview = $('<div class="ymodule-linkpreview"></div>');
        // Add name
        if (typeof (item.name) === 'string') $linkPreview.append('<div class="ymodule-name">' + item.name + '</div>');
        // if description is needed in the future
        // if (typeof(item.description) === 'string') $linkPreview.append('<div class="ymodule-desc">' + item.description + '</div>');
        // Add url
        if (typeof (item.web_url) === 'string') $linkPreview.append('<div class="ymodule-meta">' + item.web_url + '</div>');
        $a.append($linkPreview);

        // Add iframe attribute if needed
        if (isVideo) {
            $a.attr('data-ymodule-src', item.video_url);
            $a.attr('data-ymodule-title', _p.transformTitle(item.name));
        }

        $slide.append($a);

        return $slide;
    }

    // Transform title into something more human readable
    _p.transformTitle = function (title) {
        if (typeof (title) === 'string') {
            title = title.replace(/[-_]+/gi, ' ');
        }
        return title;
    }

    // Like on Yammer
    _p.likeYammer = function (item) {
        var def = $.Deferred();

        yam.platform.request({
            url: "messages/liked_by/current.json?message_id=" + item.id,
            method: "POST",
            success: function () {
                def.resolve();
            },
            error: function (e) {
                _p.onError()
                def.reject();
            }
        });

        return def;
    }

    // Unlike on Yammer
    _p.unlikeYammer = function (item) {
        var def = $.Deferred();

        yam.platform.request({
            url: "messages/liked_by/current.json?message_id=" + item.id,
            method: "DELETE",
            success: function () {
                def.resolve();
            },
            error: function () {
                _p.onError()
                def.reject();
            }
        });

        return def;
    }

    // Load images from Yammer
    _p.loadImageAttachments = function () {
        var yammerPhotoCache = null;
        var photoIterator = function (idx) {
            // attempt lookup in yammer photo cache - naming convention will be {id}.jpg
            var $this = $(this);
            var photoId = $this.attr('data-yammerattachmentid');
            var expectedPhotoFileName = photoId + ".jpg";

            var photo = yammerPhotoCache.filter(function (p) {
                // filter based on filename
                return p.File.Name.toLowerCase() === expectedPhotoFileName.toLowerCase();
            });

            if (photo.length == 0) {
                var src = encodeURIComponent($this.attr('data-src'));
                // call yammer proxy to download file, then set background image
                $.ajax({
                    url: "https://wtpintranet-functions.azurewebsites.net/api/YammerImageProxy?get=" + src + "&filename=" + photoId,
                    headers: {
                        'authtoken': _p.getAuthHeader()
                    }
                })
                    .done(function (photoUrl) {
                        $this.css({ 'background-image': 'url(\'' + photoUrl + '\')' });
                    })
                    .fail(function (error) {
                        // fail
                        // :-(
                            $this.css({ 'background-image': 'url(\'' + decodeURIComponent(src) + '\')' });
                    })
            }
            else {
                // set background image src
                $this.css({ 'background-image': 'url(\'' + photo[0].File.ServerRelativeUrl + '\')' });
            }
        }

        // Query Yammer Photo Cache
        var get = $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Yammer Photo Cache')/items?$select=Title,File/Name,File/ServerRelativeUrl&$expand=File&$orderby=ID desc&$top=50&_=" + new Date().getTime(),
            headers: {
                'Accept': 'application/json; odata=nometadata',
                'X-RequestDigest': $('#__REQUESTDIGEST').val()
            }
        });

        get.done(function (items) {
            yammerPhotoCache = items.value;
            $('.slide-image[data-loadfromyammer="true"]').each(photoIterator);
        })

        get.fail(function (error) {
            // r.i.p
        });
    }

    // On Error
    _p.onError = function () {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(this, arguments);
        }
    }

    // Auto Refresh
    _p.autoRefresh = function () {
        function refreshNewsfeed() {
            _p.loadAll()
                .done(function (data) {
                    // Filter - we only want messages from a certain user AND not in the carousel already
                    data.messages = _p.filterMessagesByUsers(data.messages);
                    data.messages = _p.filterMessagesByMessageId(data.messages);

                    // If we have messags to display
                    if (data.messages.length > 0) {
                        // We only want messages that have been posted after the most recent message in the message cache
                        var maxDate = 0;
                        _p.messageCache.forEach(function (cachedMsg) {
                            var msgDate = new Date(cachedMsg.created_at);
                            maxDate = Math.max(maxDate, msgDate.getTime());
                        })

                        var lastPostDate = new Date(maxDate);
                        data.messages = data.messages.filter(function (msg) {
                            var msgDate = new Date(msg.created_at);
                            return msgDate > lastPostDate;
                        });

                        // Now get the last 10 items in the array
                        // slice(startIdx, endIdx) - set start to MAX(0, array length - 10) to prevent negatives and account for arrays of length less than 10
                        data.messages = data.messages.slice(Math.max(0, data.messages.length - 10), data.messages.length);

                        // Update message cache
                        // Any items trimmed in the previous step will be picked up on the next pass through as they won't be cached here
                        _p.updateMessageCache(data.messages);

                        // Build message items
                        data = _p.buildMessages(data);

                        var $cellContainer = $('<div></div>');

                        // loop through each data entry and build slides
                        data.messages.forEach(function (item) {
                            $cellContainer.append(_p.buildSlide(item));
                        });

                        // Append carousell cells
                        _p.$flktyNewsfeed.flickity('append', $cellContainer.children());

                        // Get newsfeed image options
                        var newsfeedImageOptions = _p.getNewsfeedImageOptions();

                        // Initialise any new image sliders
                        $('.newsfeed').find('.image-carousel:not(.flickity-enabled)').each(function (idx) {
                            var flkty = new Flickity(this, newsfeedImageOptions);
                            flkty.resize();
                            _p.flktyImageSliders.push(flkty);
                            $(this).css({ 'opacity': '1' });
                        });

                        // Ensure sizing is correct
                        _p.flickityOnResize();
                    }
                })
                .fail(_p.onError);
        }

        try {
            // Ensure that AutoRefresh is enabled
            if (_p.parseBoolean(_p.CONFIG[keys.AutoRefresh]) !== true) return;

            // Get auto refresh speed
            var autoRefreshSpeed = parseInt(_p.CONFIG[keys.AutoRefreshSpeed]);

            setInterval(refreshNewsfeed, autoRefreshSpeed);
        }
        catch (exception) {
            // Gulp
            if (window.console) {
                var log = console.error ? console.error : console.log;
                log('_p.autoRefresh');
                log(exception);
            }
        }
    }

    // Load all posts
    _p.loadAll = function () {
        var def = $.Deferred();

        yam.platform.request({
            url: "messages/in_group/" + _p.CONFIG[keys.FeedID] + ".json",
            method: "GET",
            data: {    //use the data object literal to specify parameters, as documented in the REST API section of this developer site
                "threaded": "true",
                "limit": "100"
            },
            success: function (messages) { //print message response information to the console
                def.resolve(messages);
            },
            error: function () {
                locache.remove(_p.authTokenCacheKey);
                _p.onError();
                def.reject();
            }
        })

        return def;
    }

    // Load Token
    _p.loadToken = function (retry, retryCount) {
        if (typeof retry === "undefined") retry = false;
        if (typeof retryCount === "undefined") retryCount = 0;
        var def = $.Deferred();

        // First try to load token from localStorage
        var authToken = locache.get(_p.authTokenCacheKey);
        if (authToken !== null) {
            yam.platform.setAuthToken(authToken, function () {
                // Pretty sure this is the callback function
                def.resolve();
            });
        }
            // Otherwise get the login status through Yammer API
        else {

            _p.getLoginStatusCheck(
              function (response) {
                  if (response.access_token && response.access_token.token) {
                      _p.updateCachedAuthToken(response.access_token.token); // update cached token
                      yam.platform.setAuthToken(response.access_token.token, function () {
                          // Pretty sure i hate how complex this has become :(
                          def.resolve();
                      });
                  }
                  else {
                      if (retry && retryCount < 8) {
                          setTimeout(function () {
                              _p.loadToken(true, retryCount + 1).done(function () {
                                  def.resolve();
                              }).fail(function () {
                                  def.reject();
                              });
                          }, 500);
                      } else {
                          if (!document.getElementById('authorizeEster')) {
                            _p.askForAppAuthorization();
                          }
                          def.reject();
                      }
                  }
              }
            );

        }

        return def;
    }

    _p.getLoginStatusCheck = function (g) {
        yam.platform.request({
            url: yam.config().baseURI + "/platform/login_status.json",
            xhrFields: {
                withCredentials: !0
            },
            crossDomain: !0,
            data: yam.config().appId ? {
                client_id: yam.config().appId
            } : {},
            success: g,
            error: g
        });
    }

    _p.askForAppAuthorization = function () {
        var url = yam.config().baseURI + '/oauth2/authorize?client_id=' + yam.config().appId +
        '&response_type=token'//&redirect_uri=' + window.location.href;
        var authorizationHtml = '<div id="authorizeEster">' +
            '<style>#authorizeEster, #authorizeEster div{ height:280px; text-align: center;} #authorizeEster a{ height:30px; color: #fff !important; display: inline-block; padding: 5px;}</style>' +
            '<div><p>It seems you have not authorised Ester on your Yammer profile.</p>' +
            '<a href="' + url + '" class="fbk-show">Authorise</a> &nbsp;&nbsp;' +
            '<a class="fbk-show" href="#" onclick="IC.YammerNewsfeed.Refresh();">Refresh</a>' +
            '</div></div>';
        _p.hideLoading();
        $('.newsfeed').hide();
        $('.newsfeed').parent().append(authorizationHtml);
    }

    _p.manualRefresh = function () {
        $('#authorizeEster').remove();
        $('.newsfeed').show();
        _p.showLoading();
        _p.continueLoad();
    }

    // Background Login
    _p.backgroundLogin = function () {
        var def = $.Deferred();

        // The below frame will authenticate us using Office 365 credentials if not already logged into yammer
        var ifrm = document.createElement("iframe");
        ifrm.setAttribute("src", "https://yammer.com/office365");
        ifrm.style.display = "none";
        document.body.appendChild(ifrm)

        setTimeout(function () {
            def.resolve();
        }, 500);

        setTimeout(function () {
            $(ifrm).remove(); // Cleanup after ones self
        }, 5000);

        return def;
    }

    // Check Yammer cache
    _p.checkYammerCache = function () {
        var def = $.Deferred();
        var data = locache.get(_p.cacheKey);

        if (data == null) {
            // cache miss!
            // request data from server again
            _p.checkYammerCache_Server()
                .done(function () {
                    locache.set(_p.cacheKey, true);
                    def.resolve();
                })
                .fail(function () {
                    def.reject();
                });
        }
        else {
            def.resolve();
        }

        return def;
    }

    // Set Yammer Cache - Server
    _p.setYammerCache_Server = function () {
        var def = $.Deferred();

        _p.addListItem(_spPageContextInfo.webAbsoluteUrl, "Yammer Cache", { Title: ("" + _spPageContextInfo.userId) }, function () {
            def.resolve();
        }, function () {
            def.reject();
        });

        return def;
    }

    // add List Item
    _p.addListItem = function (url, listname, metadata, success, failure) {
        // Prepping our update
        var item = $.extend({
            "__metadata": { "type": _p.getListItemType(listname) }
        }, metadata);

        // Executing our add
        ///TODO: replace success, failure with deferred jQuery object behaviour for consistency
        $.ajax({
            url: url + "/_api/web/lists/getbytitle('" + listname + "')/items",
            type: "POST",
            contentType: "application/json;odata=verbose",
            data: JSON.stringify(item),
            headers: {
                "Accept": "application/json;odata=verbose",
                "X-RequestDigest": $("#__REQUESTDIGEST").val()
            },
            success: function (data) {
                success(data); // Returns the newly created list item information
            },
            error: function (data) {
                failure(data);
            }
        });
    };

    // Get List Item Type
    _p.getListItemType = function (name) {
        return ("SP.Data." + name[0].toUpperCase() + name.substring(1) + "ListItem").replace(' ', '_x0020_');
    };

    // Check Yammer Cache - Server
    _p.checkYammerCache_Server = function () {
        var def = $.Deferred();

        $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('Yammer Cache')/items?$select=Title&$filter=Title eq " + _spPageContextInfo.userId,
            headers: {
                'Accept': 'application/json; odata=nometadata', // using nometadata as metadata isn't needed for this request. Bonus, request time and size is reduced!
                'X-RequestDigest': $('#__REQUESTDIGEST').val()
            }
        })
		.done(function (d) {
		    if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
		        def.resolve();
		    }
		    else {
		        def.reject();
		    }
		})
		.fail(function (error) {
		    def.reject(error);
		})

        return def;
    }

    // Show page
    _p.showPage = function () {
        $('html').removeClass('html-hidden');
    }

    _p.continueLoad = function () {
        // Ensure config is loaded
        _p.loadConfig()
            .always(function () {

                _p.loadToken()
                    .done(function () {
                        _p.loadAll().done(_p.buildCarousel);
                    })
                    .fail(function () {
                        _p.backgroundLogin()
                            .done(function () {
                                _p.loadToken(true)
                                     .done(function () {
                                         _p.loadAll().done(_p.buildCarousel);
                                     });
                            });
                    });

            });
    }

    // Init
    function init() {
        _p.showLoading();
        _p.updateCacheKeys();

        // 1. Check yammer cache locally
        // 2. Check yammer cache on the server if cache miss
        // 3. Authenticate to yammer and redirect to app authorisation page if cache miss on server
        // 4. If cache success, load token
        // 5. Login failure -> login to yammer
        // 6. finally - load the yammer content
        _p.checkYammerCache()
            // Done handler - it's known that we've authorised the Yammer App
            // This is either cached locally or in SharePoint.
            .done(function () {

                // Show page
                _p.showPage();

                _p.continueLoad();
            })
            // Fail handler - it's not known if we've authorised the Yammer App
            // Authenticate to Yammer first, then redirect the user to the Yammer Authorisation Page
            .fail(function () {
                // If "access_token" is present in the hash, we've Authorised the Yammer App
                if (window.location.hash.indexOf('access_token=') > -1) {
                    // Get the auth token and cache in local storage for future use!
                    var authToken = window.location.hash.split('=')[1];
                    _p.updateCachedAuthToken(authToken);
                    yam.platform.setAuthToken(authToken);

                    // Show page
                    _p.showPage();

                    // Cache that we're authorised in LocalStorage AND in SharePoint
                    locache.set(_p.cacheKey, true);
                    _p.setYammerCache_Server();
                    _p.continueLoad();
                }
                    //  Else redirect user to Authorisation page
                else {
                    _p.backgroundLogin()
                        .done(function () {
                            var domain = window.location.toString().toLowerCase();

                            if (/https:\/\/novoitptyltd.sharepoint.com\/sites\/wtp_dev/gi.test(domain)) {
                                window.location = "https://www.yammer.com/novoit.com.au/dialog/oauth?client_id=FgBsgJ6lYLN7uxjnHE8Lg&redirect_uri=" + encodeURIComponent(window.location.href) + "&response_type=token";

                            }
                            else if (/https:\/\/wtpaustraliaptyltd.sharepoint.com\/sites\/ester/gi.test(domain)) {
                                window.location = "https://www.yammer.com/wtpartnership.com.au/dialog/oauth?client_id=faPURhN5lRaPuG0K0MvgA&redirect_uri=" + encodeURIComponent(window.location.href) + "&response_type=token";
                            }
                            else if (/https:\/\/wtpaustraliaptyltd.sharepoint.com\/sites\/intranetpt/gi.test(domain)) {
                                window.location = "https://www.yammer.com/wtpartnership.com.au/dialog/oauth?client_id=nyjnyhhTW1j7L4maPJ1hw&redirect_uri=" + encodeURIComponent(window.location.href) + "&response_type=token";
                            }
                        });
                }

            });
    }

    return {
        init: init,
        Refresh: _p.manualRefresh
    }
})();

/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// WTP Features
/* ========================================================== */

IC.Features = (function () {
    var _p = {};
    _p.cacheKey = _spPageContextInfo.siteId + 'ic_features';

    // Get data
    _p.getData = function () {
        var def = $.Deferred();

        // Attempt to get data from local storage cache
        var data = locache.get(_p.cacheKey);

        if (data == null) {
            // cache miss!
            // request data from server again
            $.ajax({
                url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('WTP Features')/items?$select=*&$orderby=fc_order asc",
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-Request-Digest': $('#__REQUESTDIGEST').val()
                }
            })
            .done(function (d) {
                if (typeof (d.value) !== 'undefined' && d.value != null && d.value.length > 0) {
                    var json = JSON.stringify(d.value);
                    locache.set(_p.cacheKey, json, 15 * 60); // cache for 15 minutes
                    def.resolve(d.value);
                }
                else {
                    def.reject();
                }
            })
            .fail(function (error) {
                def.reject(error);
            })

        }
        else {
            def.resolve(JSON.parse(data));
        }

        return def.promise();
    }

    // Build feature tiles
    _p.buildFeatures = function (data) {
        if (typeof (data) === 'undefined' || data.length == 0) return;

        var $container = $('#wt-feature-placeholder');

        data.forEach(function (item) {
            $container.append(_p.buildFeature(item));
        });
    }

    // Build feature tile
    _p.buildFeature = function (item) {
        var html = '<div class="col-mb-12 col-6 col-dt-3">' +
                        '<div class="grad-box" style="min-height: 350px;">' +
                            '<a href="' + item.fc_featurelink.Url + '">&nbsp;</a>' +
                            '<div class="grad-overlay">' +
                                '<div class="absolutely-centered">' +
                                '<div class="icon-hyperlink"></div>' +
                                    '<h2>' + item.Title + '</h2>' +
                                '</div>' +
                            '</div>' +
                            '<div class="img" style="background-image: url(\'' + item.fc_imageurl.Url + '\')"></div>' +
                            '<div style="width: 100%; display: table;">' +
                            '<div style="height: 150px; vertical-align: middle; display: table-cell; text-align: center;">' +
                                '<h2>' + item.Title + '</h2>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';

        return html;
    }

    // On error
    _p.onError = function (error) {
        // gulp
    }

    // Init
    function init() {
        _p.getData().then(_p.buildFeatures, _p.onError);
    }

    // Publicly available
    return {
        init: init
    }
})();

/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Height Equaliser
/* ========================================================== */

IC.HeightEqualiser = (function () {
    // Resize boxes to fit each row..
    function chunk(arr, chunkSize) {
        var R = [];
        for (var i = 0, len = arr.length; i < len; i += chunkSize)
            R.push(arr.slice(i, i + chunkSize));
        return R;
    };

    var _p = {};
    _p.cache = [];

    _p.equalise = function (selector, itemsPerRowFunc) {
        if (typeof (itemsPerRowFunc) != 'function') { return false; }
        var $items = _p.cache[selector];
        if (typeof ($items) == 'undefined') { $items = _p.cache[selector] = $(selector); } // quick cache
        var itemsPerRow = itemsPerRowFunc();
        $items.css({ 'height': 'auto' }); // reset
        // equalise heights
        if (itemsPerRow > 1) {
            $items = chunk($items, itemsPerRow);
            for (var i = 0; i < $items.length; i++) {
                $items[i].equalizeHeights();
            }
        }
        else {
            $items.css('height', '');
        }
    };

    return {
        equalise: _p.equalise
    }
})();

/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ########################################################## */
// #############################################################
/* ========================================================== */
// Office TimeZone Data
/* ========================================================== */

window.OfficeLocations = window.OfficeLocations || {
    National: {
        tz: 'Australia/Sydney'
    },
    Bangkok: {
        tz: 'Asia/Bangkok'
    },
    Brisbane: {
        tz: 'Australia/Brisbane'
    },
    Deakin: {
        tz: 'Australia/Canberra'
    },
    Perth: {
        tz: 'Australia/Perth'
    },
    Southbank: {
        tz: 'Australia/Victoria'
    },
    Sydney: {
        tz: 'Australia/Sydney'
    },
    Townsville: {
        tz: 'Australia/Queensland'
    }
};
