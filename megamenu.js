// https://gist.github.com/juliocesar/926500
// I mean, seriously, localStorage is supported even by your mum. How about instead of
// casing the feature out, you give users in-memory (stale) storage instead?
// If they close your application, they deserve to lose data anyway.

if (!('localStorage' in window)) {
// if (!Modernizr.localstorage) {
  window.localStorage = {
    _data       : {},
    setItem     : function(id, val) { return this._data[id] = String(val); },
    getItem     : function(id) { return this._data.hasOwnProperty(id) ? this._data[id] : undefined; },
    removeItem  : function(id) { return delete this._data[id]; },
    clear       : function() { return this._data = {}; }
  };
}

var MEGAMENU = function(options) {
    var self = this;
    var isCollapsed = false;
    var collapsedClass = 'collapsed';
    var expandClass = 'expand';
    var delayInMs = 500;

	self.target = null;

	var config = {
		list: 'Mega Menu'
	}

	// merge options into defaults
	_.assignIn(config, options);

	//# RENDER TO (target)
	self.renderTo = function(target) {
		// if a string is passed in, convert to jQuery object
		self.target = $(target);
		var def = $.Deferred();

		getItems()
			.then(processItems, onError)
			.then(renderMenu, onError)
			.then(bindEvents)
			.then(function($html) {
				def.resolve($html);
			}, function(error) {
				onError(error);
				def.reject(error);
			});

		return def.promise();
	}

	self.destroy = function() {
		if (self.target != null) {
			self.target.empty();
		}
	}

	function getItems() {
		return $.ajax({
		    url: _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + config.list + "')/Items?$select=Id,mm_url,mm_order,Title,mm_content,EncodedAbsUrl",
			headers: {
				'Accept': 'application/json; odata=verbose',
				'X-Request-Digest': $('#__REQUESTDIGEST').val()
			}
		});
	}

	//# PROCESS ITEMS
	function processItems(data) {
		var def = $.Deferred();
		var results = data.d.results;

		// In our first pass we will populate item properties
		results.forEach(function(f) {
			f.EncodedAbsUrlLower = f.EncodedAbsUrl.toLowerCase();
			var pathParts = _.drop(f.EncodedAbsUrlLower.split('/lists/')[1].split('/'), 1);
			var folders = pathParts.filter(function(part) { return part.indexOf('_.') == -1 });

			f.IsItem = (_.takeRight(pathParts)[0].indexOf('_.') > -1);
			f.IsFolder = !f.IsItem;
			f.Level = folders.length;

			if (f.IsFolder) {
				f.Level--;
			}

			f.FolderName = '';

			if (f.Level >= 1 || f.IsFolder) {
				f.FolderName = _.takeRight(folders, 1)[0];
			}
		});

		var items = _.orderBy(_.filter(results, { 'Level': 0 }), ['mm_order']);

		// now make get our next level. we will only support 2 levels at this point!
		var level1 = _.orderBy(_.filter(results, { 'Level': 1 }));
		level1.forEach(function(item) {
			var f = _.find(items, { 'FolderName': item.FolderName });
			if (typeof(f) !== 'undefined') {
				if (typeof(f.Children) === 'undefined') f.Children = [];
				f.Children.push(item);
			}
		});

		def.resolve(items);
		return def.promise();
	}

	//# RENDER MENU
	function renderMenu(data) {
	    var def = $.Deferred();
	    var $collapseMenu = $('<a class="expand-megamenu">MENU</a>');
	    var $closeMenu = $('<a class="close-megamenu">&times;</a>');
		var $html = $('<div class="megamenu"></div>');
		var $ul = $('<ul class="cf" />');

		data.forEach(function(item) {
			var $li = render_TopItem(item);
			if (typeof (item.Children) !== 'undefined' && item.Children.length > 0) {
			    $li.addClass('has-child');
				$li.append(render_Children(item));
			}
			$ul.append($li);
		});

        $ul.children('li:first').addClass('first-child');

		$html.append($ul);
		$html.append($closeMenu);
		self.target.append($collapseMenu);
		self.target.append($html);

		def.resolve($html);
		return def.promise();
	}

	//# RENDER TOP ITEM
	function render_TopItem(item) {
		var $frag = $('<li class="menu-top"></li>');
		var url = 'javascript:void(0);';
		if (item.mm_url !== null && (typeof (item.Children) === 'undefined' || item.Children.length < 1)) {
		    url = item.mm_url.Url;
		}
		$frag.append('<a href="' + url + '">' + item.Title + '</a>');

		return $frag;
	}

	//# RENDER CHILDREN
	function render_Children(item) {
		var $html = $('<div class="menu-children"></div>');

		item.Children.forEach(function(child) {
			var $frag = $('<div class="menu-col"></div>');
			var title = child.Title;
			var content = '';

			if (child.mm_url !== null) {
			    title = '<a href="' + child.mm_url.Url + '">' + title + '</a>';
			}

			if (child.mm_content !== null) {
			    content = child.mm_content;
			}

			$frag.append('<h2>' + title + '</h2>');
			var $menuContent = $('<div class="menu-content">' + content + '</div>');

			// add telephone link!
			$menuContent.find('.add-tel').each(function(idx) {
				var $this = $(this);
				$this.attr('href', 'tel:' + $this.text().replace(/\s/g, ''));
			});

			$frag.append($menuContent);
			$html.append($frag);
		});

		return $html;
	}

	//# BIND EVENTS
	function bindEvents() {
		self.target.on('click', '.menu-top.has-child', function(e) {
			var $targetParent = $(e.target.parentElement);			
			if ($targetParent.hasClass('menu-top')) {
				if ($targetParent.siblings().hasClass('is-locked')) {
					$targetParent.siblings().removeClass('is-locked');
				}
				var $this = $(this);
				$this.toggleClass('is-locked');	
			}
		});
		self.target.on('mouseenter', '.menu-top', function(e) {			
			var $this = $(this);

			if ($this.find('.menu-children').length > 0) {
				setTimeout(function() {
					if ($this.is(':hover') && !$this.siblings().hasClass('is-locked')) {
						$('html').addClass('megamenu-hover');
                        $this.addClass('is-hover');
					}
				}, delayInMs);
			}
		});
		self.target.on('mouseleave', '.menu-top', function(e) {
            var $this = $(this);



            if ($this.find('.menu-children').length > 0) {
                setTimeout(function() {
                    if (!$this.is(':hover')) {
                        $this.removeClass('is-hover');
                    }

                    // Remove megamenu-hover if there isn't a menu item :hover that has child element menu-children
                    if (self.target.find('.menu-top:hover .menu-children').length == 0) {
                        $('html').removeClass('megamenu-hover');
                    }
                }, delayInMs);
            }
		});

		$(window).on('resize', throttledCollapseCheck);
	    $(window).on('load', throttledCollapseCheck);
		throttledCollapseCheck();
	}

    //# UNBIND EVENTS


    //# COLLAPSE
    // throttle to one call per 100ms. Trailing and Leading calls will be executed.
	var $_lis = null;
	var $megaIcons = null;
	var collapsedWidth = null;

	var throttledCollapseCheck = _.throttle(function (e) {

	    $_lis = $_lis || self.target.find('.megamenu > ul > li');
	    $megaIcons = $megaIcons || $('.mega-icons');
	    var windowWidth = $(window).width();

        // Calculate width at which the mega menu should collapse
	    if (collapsedWidth === null) {
	        var w = 0;
	        var megaIconsW = $megaIcons.width();

	        $_lis.each(function(idx) {
                w += $(this).width();
            });

	        collapsedWidth = megaIconsW + w;
	    }

	    if (!isCollapsed && windowWidth < collapsedWidth) {
	        collapseMegaMenu();
	    }
	    else if (isCollapsed && $(window).width() > collapsedWidth) {
	        expandMegaMenu();
	    }
	}, 100);

    // Collapse menu
	function collapseMegaMenu() {
	    self.target.addClass(collapsedClass);
	    self.target.find('.megamenu').addClass('is-collapsed');
	    bindCollapsedEvents();
	    isCollapsed = true;
	}

    // Expand menu, remove all classes set while menu was collapsed
	function expandMegaMenu() {
	    self.target.removeClass(collapsedClass + ' ' + expandClass);
	    self.target.find('.megamenu').removeClass('is-collapsed');
	    self.target.find('.' + expandClass).removeClass(expandClass);
	    unbindCollapsedEvents();
	    isCollapsed = false;
	}

    //# BIND COLLAPSED EVENTS
	function bindCollapsedEvents() {
        // Open / close menu
	    self.target.find('.expand-megamenu').on('click', function (e) {
	        self.target.toggleClass(expandClass)
	        self.target.find('.' + expandClass).removeClass(expandClass);
	    });

	    self.target.find('.close-megamenu').on('click', function (e) {
	        self.target.removeClass(expandClass);
	        self.target.find('.' + expandClass).removeClass(expandClass);
	    });

	    // Click on mega-menu to return to menu
	    self.target.find('.megamenu > ul').on('click', function (e) {
	        if (this === e.target) {
	            var $this = $(this);
	            if ($this.hasClass(expandClass)) {
	                $this.removeClass(expandClass);
	                $this.find('.' + expandClass).removeClass(expandClass);
	            }
	        }
	    });

	    // Click on menu-item
	    self.target.find('.megamenu .menu-top > a').on('click', function (e) {
	        if (this === e.target) {
	            var $this = $(this);
	            if ($this.parent().children('.menu-children').length === 1) {
	                e.preventDefault();
	                e.stopPropagation();

	                $this.parent().addClass(expandClass);
	                self.target.find('.megamenu > ul').addClass(expandClass);
	            }
	        }
	    });
	}

    //# UNBIND COLLAPSED EVENTS
	function unbindCollapsedEvents() {
	    self.target.find('.expand-megamenu').off('click');
	    self.target.find('.megamenu > ul').off('click');
	    self.target.find('.megamenu .menu-top > a').off('click');
	}

	//# ON ERROR
	function onError(error) {
		if (window.console) {
			if (console.error) {
				console.error(error);
			}
			else if (console.log) {
				console.log(error);
			}
		}
	}

	return self;
};
