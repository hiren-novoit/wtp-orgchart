// Global variable to determine if pre-reqs have been loaded
if (typeof (window.MMOrgChartPreReqsLoaded) === 'undefined') {
    window.MMOrgChartPreReqsLoaded = false;
}

; var MMOrgChart = function (options) {
    var self = this;

    //@@ Public vars
    self.$target = null;
    self.orgChart = null;


    //@@ Private Vars
    var orgChartObj = null;
    var dataset = [];
    var dataset_processed = [];
    var dataset_orgChart = [];
	var delayedLoadScripts = $.Deferred();

    var svgPanZoomer = null;
    var svgPanZoomer_Pan = null;
    var svgPanZoomer_Zoom = null;
	
    var config = {
        // needs to be empty html element
        target: null,
        defaultFilterOptions: null,
        orgChartOptions: {},
        height: 600,
        renditionId: '6'
    }

    _.assignIn(config, options);

    // Register pre requisites
    function registerPrerequisites() {
        if (window.MMOrgChartPreReqsLoaded === false) {
			var n = new Date().getTime();
            SP.SOD.registerSod('nitorgchart-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/nit-orgchart.js?v='+ n);
            SP.SOD.registerSod('svg-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/svg.js'); 
            SP.SOD.registerSod('svg-pan-zoom-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/svg-pan-zoom.min.js');

			// For exporting Org Chart to PNG
			SP.SOD.registerSod('stackblur-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/StackBlur.js'); 
			SP.SOD.registerSod('rgbcolor-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/rgbcolor.js');
			SP.SOD.registerSod('canvg-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/canvg.js');
			SP.SOD.registerSod('filesaver-js', _spPageContextInfo.siteAbsoluteUrl + '/style library/nit.intranet/js/FileSaver.min.js');
        }
    }

    // Load prerequisites
    function loadPrerequisites() {
        var def = $.Deferred();
        // var t0 = performance.now();

        if (window.MMOrgChartPreReqsLoaded === true) {
            // console.log('MMOrgChart::loadPrerequisites took ' + (performance.now() - t0) + ' milliseconds');
            def.resolve();
        }
        else {
            // Register prerequisites
            registerPrerequisites();

            // Load JS
            SP.SOD.loadMultiple(['sp.js', 'nitorgchart-js', 'svg-js', 'svg-pan-zoom-js'], function () {
                // console.log('MMOrgChart::loadPrerequisites took ' + (performance.now() - t0) + ' milliseconds');
                def.resolve();
            });

			// Delay loading download image related js files
			setTimeout(function() {
				SP.SOD.loadMultiple(['stackblur-js', 'rgbcolor-js', 'canvg-js', 'filesaver-js'], function() {
					delayedLoadScripts.resolve();
				});
			}, 1000);

            window.MMOrgChartPreReqsLoaded = true;
        }

        return def.promise();
    }

    // Process dataset
    function processDataset(dataset) {
        return dataset.map( ds => { 
			var item = ds.adItem;
			item.EncodedAbsUrl = ds.photoItem.EncodedAbsUrl + '?RenditionID=' + config.renditionId;
			return item;
		});
    }

    // init SVG pan zoom
    function initPanZoom(init) {
		if (typeof init === 'undefined') {
			init = true;
		}
		
		if (init) {
			// enable panning and zooming
			svgPanZoomer = svgPanZoom('#OrgChart > svg', {
				viewportSelector: '.svg-pan-zoom_viewport',
				panEnabled: true,
				controlIconsEnabled: true,
				zoomEnabled: true,
				dblClickZoomEnabled: true,
				mouseWheelZoomEnabled: true,
				preventMouseEventsDefault: false,
				zoomScaleSensitivity: 0.2,
				minZoom: 1,
				maxZoom: 50,
				fit: true,
				contain: false,
				center: false,
				refreshRate: 'auto',
				beforeZoom: function () { },
				onZoom: function () { },
				beforePan: function () { },
				onPan: function () { },
				onUpdatedCTM: function () { }
			});

			window._svgPanZoomer = svgPanZoomer;
			window._svgPanZoomer.realzoom(0.5, {x:0, y:0}, true);
		}
    }

    // destroy SVG pan zoom
    function resetPanZoom() {
        // cache pan and zoom
        svgPanZoomer_Pan = svgPanZoomer.getPan();
        svgPanZoomer_Zoom = svgPanZoomer.getZoom();

        svgPanZoomer.destroy();
        $('#OrgChart > svg > g').children().appendTo('#OrgChart > svg');
        $('#OrgChart > svg > .svg-pan-zoom_viewport').remove();
    }

	function addControls() {
		// Append buttons for full screen and save
		$(self.$target).prepend("<div class='close-full-screen'>Close Full Screen</div>");
		var tools = $("<div class='org-tools'></div>");
		$(self.$target).prepend(tools);
		$(tools).append("<img class='org-full-screen-btn' src='" + _spPageContextInfo.siteAbsoluteUrl + "/Style%20Library/NIT.Intranet/img/fullscreen.png'/>");
		$(tools).append("<img class='org-download-btn' src='" + _spPageContextInfo.siteAbsoluteUrl + "/Style%20Library/NIT.Intranet/img/download.png' />");
	}

	function bindEvents() {
		self.$target.on('click', ".org-full-screen-btn", evt_fullscreenOrgChart_click);
		self.$target.on('click', ".close-full-screen", evt_fullscreenOrgChartClose_click);
		self.$target.on('click', ".org-download-btn", evt_downloadOrgChart_click);
	}

	function evt_downloadOrgChart_click() {
		var m = SP.UI.ModalDialog.showWaitScreenWithNoClose("Processing...","Please wait while we generate the Organisational Chart image",150, 330);
		
		delayedLoadScripts.done(function() {
			var sizes = window._svgPanZoomer.getSizes()
			var pan = window._svgPanZoomer.getPan();
			// Reset zoom to 1
			window._svgPanZoomer.realzoom(1, {x:0, y:0}, true);
			
			var canvasDraw = document.createElement('canvas');
			canvasDraw.width = $("svg", self.$target)[0].getBBox().width + 20;
			canvasDraw.height = $("svg", self.$target)[0].getBBox().height + 20;
			
			// Hide pan zoom controls before export
			$("#svg-pan-zoom-controls").css("display","none");
			var rawSvgXml = "<svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:svgjs=\"http://svgjs.com/svgjs\">" + $("svg", self.$target)[0].innerHTML + "</svg>";
			$("#svg-pan-zoom-controls").css("display","block");

			try {
				canvg(canvasDraw, rawSvgXml).done(function() {
					window.canvasout = canvasDraw;
					window.canvasout.toBlob(function(blob) {
						m.close();
						saveAs(blob, "WTP Org Chart.png");
					});
				});
			}
			catch (ex) {
				m.close();
			} finally {
				window._svgPanZoomer.realzoom(sizes.realZoom, pan, true);
			}
		});
	}

	function evt_fullscreenOrgChart_click() {
		$("#OrgChart").addClass("full-screen");
	}

	function evt_fullscreenOrgChartClose_click() {
		$("#OrgChart").removeClass("full-screen");
	}

    // On Error
    function onError(error) {
        if (window.console) {
            var log = console.error ? console.error : console.log;
            log(error);
        }
    }
	
    //# Filter
    self.filter = function (props) {
		var def = $.Deferred();

		// First-pass processing of dataset
		dataset_processed = processDataset(props.results);
		// Create orgchart object
		self.orgChart = new NITOrgChart({
			target: 'OrgChart'
		});
		
		$("#OrgChart svg").remove();

		// Initialise height of chart
		self.$target.css({ height: config.height + 'px' });
		window._orgChart = self.orgChart;

		var options =  { };
		if (props.options) {
			options = props.options;
		}
		// Initialise the org chart with the staff
		self.orgChart.initialiseChart(dataset_processed, options).done(function(result) {
			initPanZoom(result);
			def.resolve();
		});
    }

    //# Init
    self.init = function (shouldRender) {
        var def = $.Deferred();
        self.$target = $(config.target);
		
		self.$target.closest('.menu-top').attr('id', 'mm_staffdirectory').on('mouseenter.mmoc', function (e) {
            self.$target.closest('.menu-top').off('mouseenter.mmoc');
            self.$target.append('<div class="spinner"></div>'); // add spinner

			// load prerequisites
			STAFFDIRECTORYDATA.ensureSetup()
				.then(loadPrerequisites, onError)
				.then(function () {
					// Get dataset
					dataset = STAFFDIRECTORYDATA.getAllData();
					// First-pass processing of dataset
					dataset_processed = processDataset(dataset);
					// Create orgchart object
					self.orgChart = new NITOrgChart({
						target: 'OrgChart'
					});

					// Initialise height of chart
					self.$target.css({ height: config.height + 'px' });
					window._orgChart = self.orgChart;
								
					// Initialise the org chart with the staff
					self.orgChart.initialiseChart(dataset_processed).done(function() {
						initPanZoom();
						$(".spinner", self.$target).remove();

						addControls();
						bindEvents();

						def.resolve();
					});
				}, onError);
		});

		return def.promise();
    }

    return self;
};