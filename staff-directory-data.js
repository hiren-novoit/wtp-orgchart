var STAFFDIRECTORYDATA = (function() {
    // private scope
    var _p = {};

    _p.staffDirectoryCacheCacheKey = 'staffdirectorycache'; // share with mega menu component!
    _p.staffDirectoryCacheList = 'Staff Directory Cache';

    _p.ocManagersCacheCacheKey = 'ocmanagerscache';
    _p.ocManagersCacheList = 'Organisational Chart Managers';

    _p.staffDirectoryList = 'Staff Directory';
    _p.staffDirectoryFields = {
        userKey: 'sd_userkey',
        userLookup: 'sd_userlookup',
        sectorsLookup: 'sd_sectorslookup',
        skillsLookup: 'sd_skillslookup',
        aboutMe: 'sd_aboutme',
        startDate: 'sd_startdate',
        qualifications: 'Qualifications',
        professionalMemberships: 'Professional_x0020_Memberships'
    }
    _p.staffDirectoryCache = null;
    _p.staffDirectoryPhotoList = 'Staff Directory Photo Cache';
    _p.staffDirectoryPhotoCache = null;
    _p.staffDirectoryPhotoCacheKey = 'staffdirectoryphotos';

    _p.profilePlaceholderPicture = '/style library/nit.intranet/img/profile-placeholder.png';
    _p.profilePlaceholderPictureFLR = 'profile-placeholder.png';

    // Rendition IDs
    _p.renditions = {
        profile: 7
    }

    _p.$scope = {
        listData: null,
        photoData: null,
        adData: null,
        managersData: null
    };

    // cached response objects
    var parsedData = [];
    var currentUser = null;
    var setupDef = $.Deferred();

    // ensure cache
    function ensureCache(key, getFunc, seconds) {
        var def = $.Deferred();

        seconds = seconds || 300; // default to 5 minutes
        getFunc = getFunc || function() { return $.Deferred().reject('getFunc not set'); } // default to error

        var data = locache.get(key);
        if (data == null) {
            getFunc()
                .done(function(data) {
                    locache.set(key, JSON.stringify(data), seconds);
                    def.resolve(data);
                })
                .fail(function(error) {
                    def.reject(error);
                })
        }
        else {
            def.resolve(JSON.parse(data));
        }

        return def.promise();
    }

    // Ensure user
    _p.ensureUser = function (loginName) {
        var payload = {
            'logonName': loginName
        };

        return $.ajax({
            url: _spPageContextInfo.webAbsoluteUrl + "/_api/web/ensureuser",
            type: "POST",
            contentType: "application/json;odata=verbose",
            data: JSON.stringify(payload),
            headers: {
                "X-RequestDigest": $("#__REQUESTDIGEST").val(),
                "accept": "application/json;odata=verbose"
            }
        });
    }

    // Get list item type
    _p.getListItemType = function (name) {
        return ("SP.Data." + name[0].toUpperCase() + name.substring(1) + "ListItem").replace(' ', '_x0020_');
    };

    // Get staff directory cache data.
    // The data comes from AD, pulled out of Office 365 using an Azure Function and then cached in SharePoint.
    _p.getStaffDirectoryCacheData = function() {
        return ensureCache(_p.staffDirectoryCacheCacheKey, function() {
            return $.ajax({
                url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + _p.staffDirectoryCacheList + "')/items?$select=*&$orderby=ID desc&$top=1&_=" + new Date().getTime(),
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            });
        })
    }

     _p.getOcManagersCacheData = function() {
        return ensureCache(_p.ocManagersCacheCacheKey, function() {
			return $.ajax({
				url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + _p.ocManagersCacheList + "')/items?$select=ocm_managerId,ocm_manager/Id,ocm_manager/Title,ocm_manager/EMail,ocm_staffmemberId,ocm_staffmember/Id,ocm_staffmember/Title,ocm_staffmember/EMail&$expand=ocm_manager,ocm_staffmember&$top=4999&_=" + new Date().getTime(),
				headers: {
					'Accept': 'application/json; odata=nometadata',
					'X-RequestDigest': $('#__REQUESTDIGEST').val()
				}
            });
        });
    }
    
    // Get staff directory photos
    _p.getStaffDirectoryPhotos = function() {
        return ensureCache(_p.staffDirectoryPhotoCacheKey, function() {
            return $.ajax({
                url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + _p.staffDirectoryPhotoList + "')/items?$select=FileLeafRef,EncodedAbsUrl&_=" + new Date().getTime() + "&$top=4999",
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            })
        }, 30);
    }

    // Get staff directory list data -- uncached!
    _p.getStaffDirectoryListData = function() {
        return $.ajax({
            url: _spPageContextInfo.siteAbsoluteUrl +
                "/_api/web/lists/getbytitle('" + _p.staffDirectoryList + "')/items?" +
                "$select=*,Attachments,AttachmentFiles," + _p.staffDirectoryFields.skillsLookup + "/ID," + _p.staffDirectoryFields.skillsLookup + "/Title," + _p.staffDirectoryFields.sectorsLookup + "/ID," + _p.staffDirectoryFields.sectorsLookup + "/Title" +
                "&$expand=AttachmentFiles," + _p.staffDirectoryFields.skillsLookup + "," + _p.staffDirectoryFields.sectorsLookup +
                "&$top=4999" +
                "&_=" + new Date().getTime(),
            headers: {
                'Accept': 'application/json; odata=nometadata',
                'X-RequestDigest': $('#__REQUESTDIGEST').val()
            }
        });
    }

    // process data
    _p.processStaffDirectoryData = function() {
        // combine our three datasources into one array
        var data = [];

        var adData = JSON.parse(_p.$scope.adData.value[0].cache_data);
        var photoData = _p.$scope.photoData.value; // FileLeafRef <--
        var listData = _p.$scope.listData.value; // _p.staffDirectoryFields.userKey <--
        var managersData = _p.$scope.managersData.value;
        
        adData.forEach(function(item) {
            var email = item.Email;

            if (email !== null) {
                var sManagers = [];
                if(item.Manager != -1) {
                    var adManager = adData.find(ad => ad.Email === item.Manager);
                    if (typeof adManager !== 'undefined') {
                        sManagers.push(adManager);
                        item.adManager = adManager;
                    }
                }
                item.Manager = -1;

                var sm = managersData.filter(m => m['ocm_staffmember']['EMail'] === item.Email);
                sm.forEach( smItem => {
                    // second condition implements deduplication logic
                    var sManagersId = sManagers.map(sms => sms.id);
                    var manager = adData.find(m => smItem['ocm_manager']['EMail'] === m.Email && sManagersId.indexOf(m.id) < 0);
                    if (manager) {
                        sManagers.push(manager);
                    }
                });

                if (sManagers.length) {
                    item.Managers = sManagers;
                }

                // Everything will be joined on Email address
                var obj = {
                    Email: email,
                    search_sectors: '',
                    search_skills: '',
                    search_location: '',
                    search_role: '',
                    search_function: '',

                    adItem: item,
                    listItem: [],
                    photoItem: []
                };

                // Remove nulls from adItem
                for (var key in obj.adItem) {
                    if (obj.adItem.hasOwnProperty(key)) {
                        if (obj.adItem[key] == null) {
                            obj.adItem[key] = '';
                        }
                    }
                }

                // Get photo / placeholder
                var photoItems = photoData.filter(function(photo) {
                    return photo.FileLeafRef.toLowerCase().indexOf(email.toLowerCase()) == 0;
                });

                if (photoItems.length > 0) {
                    obj.photoItem = photoItems[0];
                }
                else {
                    obj.photoItem = {
                        FileLeafRef: _p.profilePlaceholderPictureFLR,
                        EncodedAbsUrl: _spPageContextInfo.siteAbsoluteUrl + _p.profilePlaceholderPicture
                    }
                }

                // obj.adItem.ProfilePicture = obj.photoItem.EncodedAbsUrl;

                // Get list item
                var listItems = listData.filter(function(listItem) {
                    return listItem[_p.staffDirectoryFields.userKey].toLowerCase() == email.toLowerCase();
                });

                if (listItems.length > 0) {
                    obj.listItem = listItems[0];
                }

                // Add search properties as needed
                // From adItem
                obj.search_location = obj.adItem.Location || "";
                obj.search_role = obj.adItem.Role || "";
                obj.search_function = obj.adItem.Function || "";
                // From listItem
                if (typeof(obj.listItem[_p.staffDirectoryFields.sectorsLookup]) !== 'undefined') {
                    obj.search_sectors = obj.listItem[_p.staffDirectoryFields.sectorsLookup].map(function (i) { return i.Title; }).join(', ');
                }

                if (typeof(obj.listItem[_p.staffDirectoryFields.skillsLookup]) !== 'undefined') {
                    obj.search_skills = obj.listItem[_p.staffDirectoryFields.skillsLookup].map(function (i) { return i.Title; }).join(', ');
                }

                data.push(obj);

            }
        });

        return data;
    }

    // Ensure setup
    var alreadyEnsuring = false;
    function ensureSetup() {
        if (setupDef.state() == 'pending' && !alreadyEnsuring) {
            alreadyEnsuring = true;
            var def1 = $.Deferred();
            var def2 = $.Deferred();
            var def3 = $.Deferred();
            var def4 = $.Deferred();

            // Get data!
            _p.getStaffDirectoryCacheData().then(function (data) {
                _p.$scope.adData = data;
                def1.resolve();
            }, function(error) {
                def1.reject(error);
            });

            _p.getStaffDirectoryPhotos().then(function (data) {
                _p.$scope.photoData = data;
                def2.resolve();
            }, function(error) {
                def2.reject(error);
            });

            _p.getStaffDirectoryListData().then(function (data) {
                _p.$scope.listData = data;
                def3.resolve();
            }, function(error) {
                def3.reject(error);
            });

            _p.getOcManagersCacheData().then(function (data) {
                _p.$scope.managersData = data;
                def4.resolve();
            }, function (error) {
                def4.reject(error);
            });

            // Once our requests are finished, process the data sets into one data set.
            $.when.apply(window, [def1, def2, def3, def4])
                .done(function() {
                    parsedData = _p.processStaffDirectoryData();
                    setupDef.resolve();
                })
                .fail(function(error) {
                    setupDef.reject(error);
                    onError.apply(this, arguments);
                });
        }

        return setupDef.promise();
    }

    // Add staff directory list item
    function addStaffDirectoryListItem(userKey) {
        var addDef = $.Deferred();
        var onError = function (error) { addDef.reject(error); }
        var getListItem = function () {
            return $.ajax({
                url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + _p.staffDirectoryList + "')/items?$filter=" + _p.staffDirectoryFields.userKey + " eq '" + encodeURIComponent(userKey) + "'&_=" + new Date().getTime(),
                headers: {
                    'Accept': 'application/json; odata=nometadata',
                    'X-RequestDigest': $('#__REQUESTDIGEST').val()
                }
            });
        }
        var addListItem = function () {
            // Ensure that the user actually exists in SharePoint
            _p.ensureUser(userKey)
                .done(function (userData) {

                    // Base metadata
                    var metadata = {
                        Title: userKey,
                        __metadata: {
                            type: _p.getListItemType(_p.staffDirectoryList)
                        }
                    }

                    // Add fields here
                    metadata['Title'] = userData.d.Title;
                    metadata[_p.staffDirectoryFields.userKey] = userKey;
                    metadata[_p.staffDirectoryFields.userLookup + 'Id'] = userData.d.Id;

                    var post = $.ajax({
                        url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + _p.staffDirectoryList + "')/items",
                        type: "POST",
                        contentType: "application/json; odata=verbose",
                        data: JSON.stringify(metadata),
                        headers: {
                            "Accept": "application/json;odata=verbose",
                            "X-RequestDigest": $("#__REQUESTDIGEST").val()
                        }
                    });

                    post.done(function (data) {
                        addDef.resolve(data.d);
                    })

                    post.fail(onError)
                })
                .fail(onError);
        }

        // First make sure that we aren't about to create a duplicate list item for any reason!
        getListItem()
            .done(function (data) {
                if (data.value.length >= 1) {
                    addDef.resolve(data.value[0]);
                }
                else {
                    addListItem();
                }
            })
            .fail(onError);

        return addDef.promise();
    }

    function getAllData() {
        // clone the object when returning to prevent other code from mutating the array
        return _.cloneDeep(parsedData);
    }

    function getCurrentUser() {
        // Get current user from Staff Directory
        if (currentUser != null) {
            currentUser = getAllData().filter(function (u) {
                return u.Email.toLowerCase() == _spPageContextInfo.userEmail.toLowerCase()
            });
        }

        return currentUser;
    }

    // error handler D:
    function onError(error) {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(error);
        }
    }

    return {
        ensureSetup: ensureSetup,
        getAllData: getAllData,
        addStaffDirectoryListItem: addStaffDirectoryListItem,
        getCurrentUser: getCurrentUser
    }
})();
