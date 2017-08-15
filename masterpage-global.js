/*
 ____  _____                          _____  _________ 
|_   \|_   _|                        |_   _||  _   _  |
  |   \ | |   .--.   _   __   .--.     | |  |_/ | | \_|
  | |\ \| | / .'`\ \[ \ [  ]/ .'`\ \   | |      | |    
 _| |_\   |_| \__. | \ \/ / | \__. |  _| |_    _| |_   
|_____|\____|'.__.'   \__/   '.__.'  |_____|  |_____|  
*/

// This file is loaded at the bottom of intranet.master
// All global code should be placed here

// Use an immediately invoked function expression to prevent vars leaking globally
(function () {

    // Quick check if we should show page on load -- tied in with the home page js
    if (typeof (window.ShouldShowPageOnLoad) === 'undefined' || window.ShouldShowPageOnLoad === true) {
        $('html').removeClass('html-hidden');
    }

    if (window.location.search.indexOf('locacheflush=true') > -1) {
        if (typeof (locache) !== 'undefined') {
            locache.flush();
        }
        else {
            if (window.console) { console.log('locache.flush() delayed until page load'); }
            _spBodyOnLoadFunctionNames.push('locache.flush');
        }
    }

    // Mega menu
    new MEGAMENU().renderTo('#megamenu-container').done(function () {
        var $scope = {};
        
        // Staff Directory (People Results)
        $scope.staffDirectory = new MMStaffDirectory();
        $scope.staffDirectory.renderTo('#StaffDirectory');

        // Organisation Chart
        $scope.orgChart = new MMOrgChart({
            target: '#OrgChart'
        });

        // Will initialise the Organisational Chart module,
        // + perform initial sorting & grouping,
        // + perform the first render
        $scope.orgChart.init();

        // Staff Directory needs to emit filter event that we can bind to!
        $scope.staffDirectory.onFilter(function (evt) {
            /* pass filter data to org chart */
            //if (window.console) console.log(evt);
            $scope.orgChart.filter(evt);
        })
        
    });

    // Move search into mega menu
    $('#DeltaPlaceHolderSearchArea').css({ opacity: 0 }).prependTo('.mega-icons');
    $('#DeltaPlaceHolderSearchArea').css({ opacity: 1 });

    // Bind events
    $('.service-desk-link').on('click', function (e) {
        if (e.preventDefault) { e.preventDefault(); }
        var dialogElement = $('.service-desk-html').clone();
        dialogElement.css('display', 'block');
        SP.SOD.executeFunc('sp.ui.dialog.js', 'SP.UI.ModalDialog.showModalDialog', function () {
            SP.UI.ModalDialog.showModalDialog({
                html: dialogElement[0],
                title: "Novo IT Service Desk",
                showClose: true
            });
        })
    });

    // All external links to open in new tab
    // http://stackoverflow.com/a/27412934
    $(window).on('load', function () {
        var currentDomain = document.location.protocol + '//' + document.location.hostname;
        $('a[href^="http"]:not([href*="' + currentDomain + '"])').attr('target', '_blank');
    });
})();

// FEEDBACK HANDLING
var _addFeedback = function () {
    $('body').append('<div class="fbk-collection"></div>');
    SP.SOD.registerSod('feedback-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/feedback.js?v=1.3');
    SP.SOD.registerSod('clipboard-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/clipboard.min.js?v=1.3');
    SP.SOD.loadMultiple(['feedback-js', 'clipboard-js'], function () {
        // Feedback
        var fbk = new Feedback.Collector('.fbk-collection');
        fbk.init();
        fbk.submitForm = function (data) {
            return Feedback.Poster.PostFeedback(data.page, data.rating, data.comments, data.userId);
        }
    });
}
_spBodyOnLoadFunctionNames.push('_addFeedback');
