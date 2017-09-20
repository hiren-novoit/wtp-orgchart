if (typeof(window.requestAnimationFrame) === 'undefined') {
    window.requestAnimationFrame = function(callback) {
        setTimeout(callback, 16);
    }
}


// Staff Directory in mega menu
var MMStaffDirectory = function(options) {
    var self = this;
    var timeout = null;
    self.target = null;
    self.lazyLoader = null;
    self.lazyLoaderError = false;

    var config = {
        renditionId: '6'
    }

    // callbacks
    var onFilterCallbacks = [];

    // data retrieved from server will be cached here
    // and will also be searched by Fuse.js
    var parsedDataCache = null;
    var listData = null;
    var photoData = null;
    var fuse = null;

    _.assignIn(config, options);

    // Detect IE / Edge
    var _isIE;
    function isIE() {
        if (typeof(_isIE) !== 'undefined') return _isIE;

        var ua = window.navigator.userAgent;
        _isIE = (ua.indexOf('MSIE ') > -1) || (ua.indexOf('Trident/') > -1) || (ua.indexOf('Edge/') > -1);
        return _isIE;
    }

    // load prerequisites
    function loadPrerequisites() {
        var def = $.Deferred();

        SP.SOD.registerSod('select2-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/select2.min.js');
        SP.SOD.registerSod('lazyload-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/lazyload.transpiled.min.js');
        $('head').append('<link href="' + _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/css/select2.min.css" rel="stylesheet" />');

        SP.SOD.loadMultiple(['select2-js', 'lazyload-js'], function () {
            def.resolve();
        });

        return def.promise();
    }

    // Render Items
    function renderItems() {

        //var t0 = performance.now();

        var $frag = $('<div class="people-search"></div>');

        // Search box
        $frag.append(
            '<div class="search-box">' +
                'Enter Search Keywords: <input type="text" placeholder="Name, Role, Location, Sector, Skill" class="search-input" />' +
                // '<input type="button" href="#" onclick="javascript:void(0);" class="search-button" value="Search" />' +
            '</div>'
        );

        // Additional filters
        // build dropdowns
        // sectors
        var search_sectors = [];
        var search_skills = [];
        var search_locations = [];
        var search_roles = [];
        var search_functions = [];

        var it_buildOptions = function (item, prop, arr) {
            if (item[prop] !== '') {
                item[prop].split(', ').filter(function (i) { return i; }).forEach(function (singleVal) {
                    if (arr.indexOf(singleVal) == -1) {
                        arr.push(singleVal);
                    }
                });
            }
        }

        parsedDataCache.forEach(function (item) {
            it_buildOptions(item, 'search_sectors', search_sectors);
            it_buildOptions(item, 'search_skills', search_skills);
            it_buildOptions(item, 'search_location', search_locations);
            it_buildOptions(item, 'search_role', search_roles);
            it_buildOptions(item, 'search_function', search_functions);
        });

        // sort our search params
        var sortDelegate = function (a, b) { return a.localeCompare(b); }; // sort alphabetically a-z
        search_sectors = search_sectors.sort(sortDelegate);
        search_skills = search_skills.sort(sortDelegate);
        search_locations = search_locations.sort(sortDelegate);
        search_roles = search_roles.sort(sortDelegate);
        search_functions = search_functions.sort(sortDelegate);

        // Build search drop downs

        var buildDropDown = function (label, arr, cssClass) {
            var $cont = $('<div class="search-dd-cont"></div>');
            var $dd = $('<select class="search-dd ' + cssClass + '"><option value="">-</option></select>');
            arr.forEach(function (ddVal) {
                $dd.append('<option value="' + ddVal + '">' + ddVal + '</option>');
            });

            $cont.append('<span class="search-label">' + label + ': </span>');
            $cont.append($dd);
            return $cont;
        }

        var $s1cont = buildDropDown('Location', search_locations, 'location');
        var $s3cont = buildDropDown('Sector', search_sectors, 'sectors');
        var $s4cont = buildDropDown('Skill', search_skills, 'skills');
        var $s5cont = buildDropDown('Function', search_functions, 'functions');
        var $s2cont = buildDropDown('Role', search_roles, 'roles');
        $s2cont.css('width', '100%');
        
        $frag2 = $('<div class="search-additional-filters"></div>');
        $frag2.append($s1cont);
        $frag2.append($s3cont);
        $frag2.append($s4cont);
        $frag2.append($s5cont);
        $frag2.append($s2cont);
        $frag2.append('<br />');

        $frag.append($frag2);

        $frag.append('<div class="people-results scrollbar-outer"></div>');

        var $resultsFrag = $('<div class="people-results-slider inner-content scrollbar-dynamic"></div>');

        $frag.find('.people-results').append($resultsFrag);

        //var t1 = performance.now();
        $(self.target).html($frag[0].outerHTML);

        if (!isIE()) {
            try {
                self.lazyLoader = new LazyLoad({
                    elements_selector: '.people-result > .thumb.loadLazyPlz',
                    container: document.querySelector('.people-results')
                });
            }
            catch (ex) {
                self.lazyLoaderError = true;
                self.lazyLoader = null;
                if (window.console) {
                    var log = typeof(console.error) == 'function' ? console.error : console.log;
                    log(ex);
                }
            }
        }

        // Create result boxes
        var $peopleResultsFrag = $('<div />')
        // initialiseFuse(); // HG
        parsedDataCache.forEach(function (p, idx) {
            $peopleResultsFrag.append(buildItem(p, idx));
        });

        $(self.target).find('.people-results-slider').html($peopleResultsFrag.children());
        AttachBestMatchFilter(); // HG

        //var t2 = performance.now();

        // Enable custom scrollbar
        if (isIE()) {
            $(self.target).find('.people-results').scrollbar();
        }

        //var t3 = performance.now();

        var $mmStaffDirectory = $('#mm_staffdirectory')

        $('.search-dd.location').select2({ dropdownParent: $mmStaffDirectory });
        $('.search-dd.skills').select2({ dropdownParent: $mmStaffDirectory });
        $('.search-dd.sectors').select2({ dropdownParent: $mmStaffDirectory });
        $('.search-dd.roles').select2({ dropdownParent: $mmStaffDirectory });
        $('.search-dd.functions').select2({ dropdownParent: $mmStaffDirectory });

        // Enable lazy load
        if (!isIE() && self.lazyLoader !== null) {
            self.lazyLoader.update();
        }
    }

    function OnCardClick(e) {
        var $card = $(e.currentTarget);
        $('.best-match').removeClass('best-match');
        $card.addClass('best-match');
        var cardId = +$card.attr('data-card-id');
        console.log(cardId);
        if(cardId) {
            onFilter({options: {
                bestMatchSearch: true,
                showDirectReportsOnly: false,
                bestMatch: {id: cardId},
                adminSearch: false
            }, results: parsedDataCache});    
        }
    }

    function AttachBestMatchFilter() {
        $('.people-result.carousel-cell').on('click', OnCardClick);
    }

    function buildItem(p, idx, isFromBms) {
        if (typeof(p.item) !== 'undefined') { p = p.item; }

        var html = [];

        // '<div class="thumb" data-src="' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '" style="background-image: url(\'' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '\')"></div>' +
        var itemId =  p.adItem.id ? p.adItem.id : 0;
        var bestMatchClass = '';
        if(typeof isFromBms !== undefined && isFromBms === true && typeof idx !== undefined && idx === 0) {
            bestMatchClass = ' best-match';
        }
        html.push('<div class="people-result carousel-cell'+ bestMatchClass +'" data-card-id="'+ itemId +'">');
        if (self.lazyLoader == null || isIE() || p.photoItem.EncodedAbsUrl.indexOf('/profile-placeholder.png') > -1) {
            html.push('<div class="thumb" data-src="' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '" style="background-image: url(\'' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '\')"></div>');
        }
        else {
            html.push('<div class="thumb loadLazyPlz" data-src="' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '" data-original="' + p.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId + '"></div>');
        }
                    
        html.push('<div class="person">' +
            '<h4 class="title"><a href="' + _spPageContextInfo.siteAbsoluteUrl + '/pages/staff-directory.aspx?userkey=' + p.adItem.Email + '">' + p.adItem.Name + '</a></h4>' +
            '<div class="meta position">' + p.adItem.Role + '</div>' +
            '<div class="meta email"><a href="mailto:' + p.adItem.Email + '">' + p.adItem.Email + '</a></div>');

        // If office phone isn't blank
        if (p.adItem.OfficePhone !== '') {
            html.push('<div class="meta phone">P: <a href="tel:' + p.adItem.OfficePhone.replace(/ /gi, '') + '">' + p.adItem.OfficePhone + '</a></div>');
        }

        // If mobile phone isn't blank
        if (p.adItem.MobilePhone !== '') {
            html.push('<div class="meta phone">M: <a href="tel:' + p.adItem.MobilePhone.replace(/ /gi, '') + '">' + p.adItem.MobilePhone + '</a></div>');
        }

        html.push('</div>' +
                '</div>');

        return html.join('');
    }

    // initialise FUSE
    function initialiseFuse(items) {
		if(typeof items === 'undefined') {
			items = parsedDataCache;
		}
        // http://fusejs.io/
        // if this needs to be adjusted you can test with JSON by entering
        // STAFFDIRECTORYDATA.ensureSetup().done(function() { console.log(JSON.stringify(STAFFDIRECTORYDATA.getAllData())) })
        // into the console to get the objects we search
        var options = {
            include: ["score"],
            shouldSort: true,
            tokenize: true,
            threshold: 0.3,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 2,
            keys: [
                { name: "Email", weight: 0.1 },
                { name: "search_location", weight: 0.2 },
                { name: "search_role", weight: 0.2 },
                { name: "search_skills", weight: 0.1 },
                { name: "search_sectors", weight: 0.1 },
                { name: "adItem.FirstName", weight: 0.6 },
                { name: "adItem.Name", weight: 0.5 },
                { name: "adItem.LastName", weight: 0.4 },
            ]
        };

        fuse = new Fuse(items, options);

        return true;
    }

    // Get best matches from result set
    function getBestMatches(results) {
        if (results.length == 0) return results;
        var bestScore = results[0].score;
        var bestMatches = results.filter(function(i) { return i.score == bestScore; });
        return bestMatches;
    }

    // Show results
    function renderResults(bestMatches, otherMatches) {
        requestAnimationFrame(function () {
            // CLEAR ALL
            $('.people-results-slider').html('');

            // Render results
            var $frag = $('<div></div>');
            var $best = $('<div class="best-matches"></div>');
            var $other = $('<div class="other-matches"></div>');

            // Best Match(es)
            if (bestMatches.length > 0) {
                if (bestMatches.length == 1) {
                    $best.append('<h3>Best match</h3>');
                }
                else {
                    $best.append('<h3>Best matches</h3>');
                }

                bestMatches.forEach(function (r, idx) {
                    $best.append(buildItem(r, idx, true));
                });

                $frag.append($best);
            }

            // Other results
            if (otherMatches.length > 0) {
                $other.append('<h3>Other results</h3>');

                otherMatches.forEach(function (r, idx) {
                    $other.append(buildItem(r, idx));
                });

                $frag.append($other);
            }

            // Build HTML string
            var html = '';
            $frag.children().each(function (idx) {
                html += $(this)[0].outerHTML;
            })

            $('.people-results-slider').html(html);
            AttachBestMatchFilter();
            if (!isIE() && self.lazyLoader !== null) { self.lazyLoader.update(); }
        });
    }

    function renderAll() {
        $('.people-results-slider').html('');
        var $resultsFrag = $('<div></div>');
        fuse.list.forEach(function(p, idx) {
            $resultsFrag.append(buildItem(p, idx));
        });
        $('.people-results-slider').html($resultsFrag.children());
        AttachBestMatchFilter();
        if (!isIE() && self.lazyLoader !== null) { self.lazyLoader.update(); }
    }

    var dropDownFilters = { };
    // Apply dropdown filters
    function applyDropdownFilters(results) {

        function applyFilter(items, propKey, selector, split) {
            // Get filter value from dropdown
            var val = $(selector).val().trim().toLowerCase();
            var lbl = $(selector).parent().find('span.search-label').text().trim().replace(':', '');
            dropDownFilters[lbl] = val;
            // Should split? Used for comma separated fields
            var shouldSplit = typeof(split) !== 'undefined';

            // If there is a filter option selected
            if (val !== '') {
                items = items.filter(function(item) {
                    // Get the object to search - this line is a little stupid, sorry!
                    var _item = typeof (item.item) !== 'undefined' ? item.item : item;

                    // Get the property to search
                    var str = _item[propKey].toLowerCase();

                    // Should, we, split, the string, into, an, array?
                    if (shouldSplit) {
                        return str.split(split).indexOf(val) > -1;
                    }
                    else {
                        return str === val;
                    }
                });
            }

            return items;
        }

        results = applyFilter(results, 'search_location', '.search-dd.location');
        results = applyFilter(results, 'search_role', '.search-dd.roles');
        results = applyFilter(results, 'search_sectors', '.search-dd.sectors', ', ');
        results = applyFilter(results, 'search_skills', '.search-dd.skills', ', ');
        results = applyFilter(results, 'search_function', '.search-dd.functions', ', ');

        return {results, dropDownFilters};
    }

    function fuseSearch(searchString) {
        return fuse.search(searchString);
    }


	function performDropdownSearch(e) {
		var filtered = applyDropdownFilters(parsedDataCache);
		initialiseFuse(filtered.results);
        
		performKeywordSearch(filtered.dropDownFilters);
	}

    var prevSearchString = '';
    var prevBestMatch = {id: -1};
    function keywordSearch(filterData) {
        var trigerredByKeywordSearch = !!filterData.currentTarget;
        var adminSearch = !trigerredByKeywordSearch &&  filterData.Function && filterData.Function === 'administration';
        var val = $('.search-input').val().trim();
        var options = {
            bestMatchSearch: false,
            showDirectReportsOnly: false,
            bestMatch: {id: -1},
            adminSearch: adminSearch
        }
        if (!trigerredByKeywordSearch || (trigerredByKeywordSearch && val !== prevSearchString)) {
            var bestMatches = [];
            var otherMatches = [];

            if (val.length <= 2) {
                options.adminSearch = dropDownFilters.Function && dropDownFilters.Function.length;
                renderAll();
            }
            else {
                // fuzzy search on the name and filters if we have dropdown filters AND searchbox
                var fuseMatches = fuseSearch(val);

                // Get best matches from fuse matches
                bestMatches = getBestMatches(fuseMatches);

                // Build other matches --- other matches = { fuseMatches } - { bestMatches }
                for(var i = 0; i < fuseMatches.length; i++) {
                    if(bestMatches.indexOf(fuseMatches[i]) === -1) {
                        otherMatches.push(fuseMatches[i]);
                    }
                }

                // render results!
                renderResults(bestMatches, otherMatches);

                if (bestMatches.length) {
                    options.bestMatchSearch = true;
                    options.bestMatch = bestMatches[0].item.adItem;
                } else {
                    options.bestMatchSearch = true;
                    options.bestMatch = {id: -2};
                }
            }
            if (options.bestMatchSearch) {
                if (prevBestMatch && options && options.bestMatch && prevBestMatch.id !== options.bestMatch.id){
                    onFilter({options: options, results: parsedDataCache});
                }
            } else {
                onFilter({options: options, results: fuse.list});
            }
            prevBestMatch = options.bestMatch;
            prevSearchString = val;
        }
    }

    function performKeywordSearch(e) {
        requestAnimationFrame(function(){
            keywordSearch(e);
        });
    }
	
    // onFilter - call callbacks
    function onFilter(props) {
        onFilterCallbacks.forEach(function (callback) {
            callback(props);
        })
    }

    // Bind events
    function bindEvents() {
        $('.search-input').on('keyup', function(event) {
            clearTimeout(timeout);

            setTimeout(function(){
                performKeywordSearch(event);
            }, 500);
        });
        $('.search-dd').on('change', performDropdownSearch);
    }

    // on Error - what to do?
    function onError(error) {
        //
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(error);
        }
    }

    //# On Filter
    self.onFilter = function (callback) {
        if (typeof (callback) === 'function') {
            onFilterCallbacks.push(callback);
        }
    }

    //# Render To
    self.renderTo = function(target) {
        var def = $.Deferred();

        self.target = target;

        $(self.target).closest('.menu-top').attr('id', 'mm_staffdirectory').on('mouseenter.mmsd', function (e) {
            $(self.target).closest('.menu-top').off('mouseenter.mmsd');
            $(self.target).append('<div class="spinner"></div>'); // add spinner

            setTimeout(function () {
                STAFFDIRECTORYDATA.ensureSetup()
                    .then(loadPrerequisites, onError)
                    .then(function () {
                        // get data and sort by name ascending (A-Z)
                        parsedDataCache = STAFFDIRECTORYDATA.getAllData().sort(function (a, b) {
                            return a.adItem.Name.localeCompare(b.adItem.Name)
                        });

                        // remove spinner before rendering
                        $(self.target).find('.spinner').remove();
                    })
                    .then(renderItems, onError)
                    .then(initialiseFuse, onError)
                    .then(bindEvents, onError)
                    .then(function () {
                        def.resolve();
                    })
            }, 400);

        });

        return def.promise();
    }

    return self;
}
