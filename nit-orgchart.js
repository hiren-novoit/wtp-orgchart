/*
 ____  _____                          _____  _________ 
|_   \|_   _|                        |_   _||  _   _  |
  |   \ | |   .--.   _   __   .--.     | |  |_/ | | \_|
  | |\ \| | / .'`\ \[ \ [  ]/ .'`\ \   | |      | |    
 _| |_\   |_| \__. | \ \/ / | \__. |  _| |_    _| |_   
|_____|\____|'.__.'   \__/   '.__.'  |_____|  |_____|  
*/

// 
function __getNow() {
	if (window.performance && window.performance.now) {
		return performance.now();
	}
	else {
		return new Date().getTime();
	}
}

function NITOrgChart(options) {
	var self = this;

	var config = {
		target: 'OrgChart',
		locationsCache: 'locationscache',
		locationsCacheList: 'Organisational Chart Locations',
		levelsCache: 'levelscache',
		levelsCacheList: 'Organisational Chart Roles',
		managersCache: 'managerscache',
		managersCacheList: 'Organisational Chart Managers',
		assistantOffset: {y: 140, x: 70}
	}

	if (typeof (options) === 'object') {
		if (typeof (_) === 'function' && typeof (_.assignIn) === 'function') {
			_.assignIn(config, options);
		}
		else {
			for (var key in options) {
				config[key] = options[key];
			}
		}
	}

	// Get Locations
	function getLocations() {
		return ensureCache(config.locationsCache, function (url) {
			if (typeof url === 'undefined') {
				url = _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + config.locationsCacheList + "')/items?$select=Title,ocl_bg,ocl_title,ocl_role&$orderby=ocl_order asc&_=" + new Date().getTime();
			}
			return $.ajax({
				url: url,
				headers: {
					'Accept': 'application/json; odata=nometadata',
					'X-RequestDigest': $('#__REQUESTDIGEST').val()
				}
			});
		})
	}

	// Get Role Levels
	function getLevels() {
		return ensureCache(config.levelsCache, function (url) {
			if (typeof url === 'undefined') {
				url = _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + config.levelsCacheList + "')/items?$select=Title,ocr_level,ocr_order&$orderby=ocr_order asc&_=" + new Date().getTime();
			}
			return $.ajax({
				url: url,
				headers: {
					'Accept': 'application/json; odata=nometadata',
					'X-RequestDigest': $('#__REQUESTDIGEST').val()
				}
			});
		})
	}

	// Get (multi) Managers
	function getManagers() {
		return ensureCache(config.managersCache, function (url) {
			if (typeof url === 'undefined') {
				url = _spPageContextInfo.siteAbsoluteUrl + "/_api/web/lists/getbytitle('" + config.managersCacheList + "')/items?$select=ocm_managerId,ocm_manager/Id,ocm_manager/Title,ocm_manager/EMail,ocm_staffmemberId,ocm_staffmember/Id,ocm_staffmember/Title,ocm_staffmember/EMail&$expand=ocm_manager,ocm_staffmember&_=" + new Date().getTime();
			}
			return $.ajax({
				url: url,
				headers: {
					'Accept': 'application/json; odata=nometadata',
					'X-RequestDigest': $('#__REQUESTDIGEST').val()
				}
			});
		})
	}

	function recursiveDataCalls(getFunc, url) {
		var def = $.Deferred();
		var result = {};
		getFunc(url)
			.done(function (data) {
				if (data['odata.nextLink']) {
					recursiveDataCalls(getFunc, data['odata.nextLink']).done(function(rcData){
						data.value = data.value.concat(rcData.value)
						def.resolve(data);
					}).fail(function (error) {
						def.reject(error);
					});
				} else {
					def.resolve(data);
				}
			})
			.fail(function (error) {
				def.reject(error);
			})		
		return def.promise();
	}

	// ensure cache
	function ensureCache(key, getFunc, seconds) {
		var def = $.Deferred();

		seconds = seconds || 300; // default to 5 minutes
		getFunc = getFunc || function () { return $.Deferred().reject('getFunc not set'); } // default to error

		var data = locache.get(key);
		if (data == null) {
			recursiveDataCalls(getFunc)
				.done(function (data) {
					locache.set(key, JSON.stringify(data), seconds);
					def.resolve(data);
				})
				.fail(function (error) {
					def.reject(error);
				});
		}
		else {
			def.resolve(JSON.parse(data));
		}

		return def.promise();
	}

	var MAXLEVELS = 10;
	var MAXSUBLEVELS = 10;
	var MANAGERLINES = false;
	var MAXPERLEVEL = 15;

	function traverse(t, direction, current, staff) {
		// console.log(current.id, current.prev);
		// console.log(t.length);
		var alreadyTraversed = t.find(n => n.id === current.id);
		var inStaffArray = true;
		if (staff) {
			inStaffArray = staff.find(s => s.id === current.id);
		}
		if (typeof alreadyTraversed === 'undefined' && inStaffArray) {
			t.push(current);
			var next = current[direction];
			if(next) {
				for(var subKey in next){
					traverse(t, direction, next[subKey], staff)
					// console.log(t.length);
				}
			}
		}
		// 	current.traversed = true;
	}

	function normaliseLevels(t, level, current) {
		var alreadyTraversed = t.find(n => n.id === current.id);
		if (typeof alreadyTraversed === 'undefined') {
			current.normalisedLevel = level;
			t.push(current);
			if (Array.isArray(current.Managers)) {
				current.Managers.forEach(m => {
					normaliseLevels(t, level - 1, m);
				});
			}
			if (Array.isArray(current.subordinates)) {
				current.subordinates.forEach(s => {
					normaliseLevels(t, level + 1, s);
				});
			}
		}
	}

	function reassignNormalisedLevels(staff) {
		var tree = []
		var topLevelManagers = staff.filter(s => !Array.isArray(s.Managers));

		function reassignNormalisedLevelForNode(normalisedTree, level, currentNode) {
			var alreadyTraversed = normalisedTree.find(n => n.id === currentNode.id);
			if (typeof alreadyTraversed === 'undefined' 
				|| (level > 0 && level > currentNode.normalisedLevel)
			) {
				currentNode.normalisedLevel = level;
				normalisedTree.push(currentNode);
				if (Array.isArray(currentNode.subordinates)) {
					currentNode.subordinates.forEach(s => {
						reassignNormalisedLevelForNode(normalisedTree, level + 1, s);
					});
				}
			}
		}
		topLevelManagers.forEach(tlm => reassignNormalisedLevelForNode(tree, 0, tlm));
	}

	function getReportingHierarchy(tree, bestMatch) {
		var reportingHierarchy = [];
		var selfNDirectReports = [];
		
		if (bestMatch) {
			traverse(selfNDirectReports, 'subordinates', bestMatch);
		}

		return reportingHierarchy;
	}

	function buildReportingTree(staff) {
		staff.forEach((s) => {
			// console.log(s.id, s.Manager);
			if(Array.isArray(s.Managers)) {
				var managersObj;
				s.Managers.forEach(m => {
					var manager = staff.find(mObj => mObj.id === m.id);
					if (typeof manager !== 'undefined') {
						// console.log('Manager found.')
						if (typeof manager.subordinates === 'undefined') {
							// console.log('Created sub o obj')
							manager.subordinates = [];
						}					
						manager.subordinates.push(s);
						if (typeof managersObj === 'undefined') {
							managersObj = [];
						}
						managersObj.push(manager);
						s.pushedIntoTree = true;
					}
				});
				if (managersObj) {
					s.Managers = managersObj; 
				}
			}
		});
	}

	function IsNullOrUndefined(p) {
		return (typeof p === 'undefined' || p === null);
	}

	function orderStaff(staff, highestLevel) {
		var gapFillers = [];

		// Add properties used for positioning to all staff
		for (var i = 0; i < staff.length; i++) {
			staff[i].pos = null;
			staff[i].childOffset = 0;
			staff[i].SubLevel = 0;
			staff[i].IsAssistant = false;

			if (staff[i].Assistant != null) {
				staff[i].Assistant.pos = null;
				staff[i].Assistant.childOffset = 0;
				staff[i].Assistant.SubLevel = 0;
				staff[i].Assistant.IsAssistant = true;
			}
		}

		// First move all staff who have no parent or children out of the way (no relationship groups to care about)
		// Also anyone on the bottom level, don't put them in thier own trees - just group them with the rest
		for (var i = staff.length - 1; i >= 0; i--) {
			if ((staff[i].Manager == -1 && !hasChildren(staff, staff[i].id)) || staff[i].Level == highestLevel) {
				gapFillers.push(staff[i]);
				staff.splice(i, 1);
			}
		}

		// Keep track of the position of trees / free elements
		var allStaff = [];

		var levelMaxPos = [];
		for (var i = 0; i < MAXLEVELS * MAXSUBLEVELS; i++) {
			levelMaxPos.push(0);
		}

		var startOffset = 0;

		var sortByLevelRoleName = (a, b) => {
			var sortPropOrder = {
								"Level": 1,
								"roleOrder": 1,
								"Name": 1
								};
			return sortBy(a, b, sortPropOrder);
		};
		gapFillers.sort(sortByLevelRoleName);
		var assistantsArray = [];
		// Go through anything that's not on a tree and add it to the start
		// Be sure to handle sublevels on overflow of MAXPERLEVEL
		var fillersLen = gapFillers.length; // Evaluate this once, as we will be adding items to the array while we loop
		for (var i = 0; i < fillersLen; i++) {
			while (levelMaxPos[gapFillers[i].Level * MAXSUBLEVELS + gapFillers[i].SubLevel] >= MAXPERLEVEL) {
				gapFillers[i].SubLevel++;
			}

			gapFillers[i].pos = levelMaxPos[gapFillers[i].Level * MAXSUBLEVELS + gapFillers[i].SubLevel]++;

			// If this person has an assistant, put them in
			if (gapFillers[i].Assistant != null) {
				var assistant = gapFillers[i].Assistant;
				assistant.SubLevel = gapFillers[i].SubLevel;
				assistant.Level = gapFillers[i].Level;
				assistant.Managers = [gapFillers[i]]; //HG
				assistantsArray.push(assistant);
			}

			if (gapFillers[i].pos + 0.5 > startOffset) {
				startOffset = gapFillers[i].pos + 0.5;
			}
		}

		centerAlignStaff(gapFillers);
		//HG
		assistantsArray.forEach((gf) => {
			gf.pos = gf.Managers[0].pos + 1;
		});
		
		allStaff = allStaff.concat(gapFillers,assistantsArray);

		allStaff.forEach(as => as.pos *= 1.25);

		return allStaff;
	}

	function centerAlignStaff(staff) {
		var minPos = -1;
		var maxPos = -1;
		var levels = [];

		for (var i = 0; i < MAXLEVELS * MAXSUBLEVELS; i++) {
			levels.push(0);
		}

		// First get the min and max pos + number of items in each level
		for (var i = 0; i < staff.length; i++) {
			if (minPos == -1 || staff[i].pos < minPos) {
				minPos = staff[i].pos;
			}

			if (maxPos == -1 || staff[i].pos > maxPos) {
				maxPos = staff[i].pos;
			}

			if (staff[i].Level != -1) {
				levels[staff[i].Level * MAXSUBLEVELS + staff[i].SubLevel]++;
			}
		}

		// Go back through and increment the position of each item
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Level != -1) {
				staff[i].pos = staff[i].pos + (maxPos - minPos + 1) / 2 - (levels[staff[i].Level * MAXSUBLEVELS + staff[i].SubLevel] / 2);
			}
		}
	}

	function hasChildren(staff, id) {
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Manager == id) {
				return true;
			}
		}

		return false;
	}

	function renderChart(staff, locationMappings, drawManagerLines) {
		var draw = SVG(config.target);
		var t0 = __getNow();
		var fontFamily = 'PT Sans'; // for WTP, this will be PT Sans

		// settings for title
		var titleWeight = "bold";
		var titleSize = "36";

		for (var i = 0; i < locationMappings.length; i++) {
			var loc = locationMappings[i];
			if(typeof loc.EndPos !== 'undefined' && typeof loc.StartPos !== 'undefined') {
				if (loc.EndPos === loc.StartPos) {
					loc.EndPos++;
				} 
				var rect = draw.rect(((loc.EndPos - loc.StartPos + 1) * 140) - 20, 60)
					.move(loc.StartPos * 140 + 20, 10)
					.attr({ fill: loc.ocl_bg });

				var locText = draw.text(function (add) {
					add.tspan(loc.Title.toUpperCase()).fill(loc.ocl_title)
				}).font({ family: fontFamily, size: titleSize, anchor: 'middle', leading: '0em', weight: titleWeight });

				var locTextLen = locText.node.getComputedTextLength();
				locText.move(loc.StartPos * 140 + 30 + (locTextLen / 2), 20);
			}
		}

		var topOffset = 100;
		var assistantOffset = [];
		var maxRows = MAXLEVELS * MAXSUBLEVELS;
		for(i = 0; i < maxRows; i++) {
			assistantOffset.push(0);
		}
		staff.forEach(s => {
			if (s.Assistant) {
				var i = s.Level * MAXLEVELS + s.SubLevel;
				if (i < maxRows) {
					i++;
				}
				assistantOffset[i] = config.assistantOffset.y;
			}
		});
		assistantOffset.forEach( (ao, i) => {
			if (i > 0) {
				assistantOffset[i] += assistantOffset[i-1]
			}
		});
		for (var i = 0; i < staff.length; i++) {

			var curr = staff[i];
			var x = 140 * curr.pos;
			var y;
			if (typeof drawManagerLines !== 'undefined' && drawManagerLines === true) {
				y = topOffset + (200 * curr.Level * 1.25) + (curr.SubLevelOffset * 140) + assistantOffset[curr.Level * MAXLEVELS + curr.SubLevel];
			} else {
				y = topOffset + (200 * curr.Level) + (curr.SubLevelOffset * 140) + assistantOffset[curr.Level * MAXLEVELS + curr.SubLevel];
			}
			if (curr.IsAssistant) {
				y += config.assistantOffset.y;
				x -= config.assistantOffset.x;
			}

			var card = new Card(draw, curr, locationMappings);
			card.x = x;
			card.y = y;
			card.draw();

			staff[i].Card = card;

			///TODO
			// This needs to be externally customisable somehow
			card.onClick = function (evt, obj) {
				// redirect to staff directory page
				if (obj.Email !== '') {
					window.location = _spPageContextInfo.siteAbsoluteUrl + "/pages/staff-directory.aspx?userkey=" + obj.Email;
				}
			}
		}

		if (typeof drawManagerLines !== 'undefined' && drawManagerLines) {
			DrawManagerLines(draw, staff, locationMappings);
		}
		window._rawSvgXml = draw.node.outerHTML;
		var t1 = __getNow();
		window.console && console.log('NITOrgChart::buildChart took ' + (t1 - t0) + ' milliseconds');
	}

	function DrawManagerLines(draw, staff, locationMappings) {
		// var rootNode = staff.find(s => s.rootNode);

		// Draw lines from manager;
		staff.forEach (rootNode => {
			var locMapping = locationMappings[rootNode.locationId];
			var cardWidth = 120;
			var cardHeight = 88;
			var midY = 81;
			var xMod = 20;
			var yMod = 40;
			var photoHeight = 35;
			var assistMod = 0;
			var firstManager;
			var additionalManagerOffset = {x: 0, y: 10};
			var group = draw.group();
			if (Array.isArray(rootNode.subordinates)) {
				var leftMostSub = rootNode.subordinates[0];
				var rightMostSub = rootNode.subordinates[rootNode.subordinates.length-1];
				assistMod = typeof rootNode.Assistant === 'undefined'? 0 : config.assistantOffset.y;
				//cond Added for multiple managers scenario - start
				if (leftMostSub && rightMostSub) {
					if (leftMostSub.pos > rootNode.pos) {
						leftMostSub = rootNode;
					}
					if (rightMostSub.pos < rootNode) {
						rightMostSub = rootNode;
					}
					var horizontal = {
						start: {
							x: leftMostSub.Card.x + xMod + cardWidth/2,
							y: rootNode.Card.y + yMod + cardHeight + midY + assistMod
						},
						end: {
							x: rightMostSub.Card.x + xMod + cardWidth/2,
							y: rootNode.Card.y + yMod + cardHeight + midY + assistMod
						}
					};					
					group.line(horizontal.start.x, horizontal.start.y, horizontal.end.x, horizontal.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
					var vertical = {
						start: {
							x: rootNode.Card.x + xMod + cardWidth/2,
							y: rootNode.Card.y + yMod + cardHeight
						},
						end: {
							x: rootNode.Card.x + xMod + cardWidth/2,
							y: rootNode.Card.y + yMod + cardHeight + midY + assistMod
						}
					}
					group.line(vertical.start.x, vertical.start.y, vertical.end.x, vertical.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });	
				}
				//cond Added for multiple managers scenario - end
			}
			if (Array.isArray(rootNode.Managers)) {
				if (rootNode.Managers.length > 1) {
					var leastLevel = Math.max.apply(null, rootNode.Managers.map(m => m.Level));
					var managerAtLowestLevel = rootNode.Managers.find(rm => rm.Level === leastLevel && typeof rm.Assistant !== 'undefined') || rootNode.Managers.find(rm => rm.Level === leastLevel);
					var addMAssistMod = typeof managerAtLowestLevel.Assistant === 'undefined'? 0 : config.assistantOffset.y;

					var leftNode = rootNode.Managers.find((m, i) => i !== rootNode.primaryManagerIndex);
					if (leftNode && rootNode.pos < leftNode.pos) {
						leftNode = rootNode;
					}
					var rightNode;
					for(var i=rootNode.Managers.length-1; i > -1; i--) {
						if (i !== rootNode.primaryManagerIndex) {
							rightNode = rootNode.Managers[i].pos > rootNode.pos? rootNode.Managers[i] : rootNode;
							break;
						}
					}
					
					var horizontalSub = {
						start: {
							x: leftNode.Card.x + xMod + cardWidth/2,
							y: managerAtLowestLevel.Card.y + yMod + cardHeight + midY + addMAssistMod + additionalManagerOffset.y
						},
						end: {
							x: rightNode.Card.x + xMod + cardWidth/2,
							y: managerAtLowestLevel.Card.y + yMod + cardHeight + midY + addMAssistMod + additionalManagerOffset.y
						}
					};
					group.line(horizontalSub.start.x, horizontalSub.start.y, horizontalSub.end.x, horizontalSub.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg, "stroke-dasharray":"5, 5" });			
				}

				rootNode.Managers.forEach((manager, i) => {
					if ((typeof rootNode.primaryManagerIndex !== 'undefined' && rootNode.primaryManagerIndex === i) 
						|| (typeof rootNode.primaryManagerIndex === 'undefined' && i === 0)
					) {
						//var manager = rootNode.Managers[i];
						assistMod = typeof manager.Assistant === 'undefined'? 0 : config.assistantOffset.y;
						var verticalSub = {
							start: {
								x: rootNode.Card.x + xMod + cardWidth/2,
								y: manager.Card.y + yMod + cardHeight + midY + assistMod -1
							},
							end: {
								x: rootNode.Card.x + xMod + cardWidth/2,
								y: rootNode.Card.y + yMod - photoHeight
							}
						};
						group.line(verticalSub.start.x, verticalSub.start.y, verticalSub.end.x, verticalSub.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
					}
					 else {
						var verticalSub  = {
							start: {
								x: manager.Card.x + xMod + cardWidth/2,
								y: manager.Card.y + yMod + cardHeight
							},
							end: {
								x: manager.Card.x + xMod + cardWidth/2,
								y: managerAtLowestLevel.Card.y + yMod + cardHeight + midY + addMAssistMod + additionalManagerOffset.y
							}
						};
						group.line(verticalSub.start.x, verticalSub.start.y, verticalSub.end.x, verticalSub.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg, "stroke-dasharray":"5, 5" });
					}
				});
			}
		})
	}

	function reverseLevels(staff) {
		var maxLevel = 0;
		var swapLevels = [];

		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Level > maxLevel) maxLevel = staff[i].Level;
		}

		for (var i = maxLevel; i >= 0; i--) {
			swapLevels.push(i);
		}

		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Level >= 0) {
				staff[i].Level = swapLevels[staff[i].Level];
			}
		}
		return staff;
	}

	function getKey(buildOptions) {
		var key = "nit-orgchart-empty";
		var emptyDropDownFilters = {
			Function : "",
			Location : "",
			Role : "",
			Sector : "",
			Skill : ""
		};

		if (typeof buildOptions.bestMatchSearch !== 'undefined' && buildOptions.bestMatchSearch === true) {
			key = 'bms-' + buildOptions.bestMatch.id;
		} else if (typeof buildOptions.dropDownFilters !== 'undefined' && !_.isEqual(emptyDropDownFilters, buildOptions.dropDownFilters)) {
			key = JSON.stringify(buildOptions.dropDownFilters);
		}

		return key;
	}

	function restoreCachedChart(buildOptions) {
		var t0 = __getNow();
		var key = getKey(buildOptions);
		var data = locache.get(key);
		// var data = self[key];
		if (data) {
			console.log('Restoring: ' + key);
			$("#OrgChart").append(JSON.parse(data));
			// $("#OrgChart").append(data);
			var t1 = __getNow();
			var timeToBuildChart = t1-t0;
			console.log('Time to restor chart: ' + timeToBuildChart);
		return true;
		} else {
			return false;
		}
	}

	function cacheChart(buildOptions) {
		var key = getKey(buildOptions);
		var data = window._rawSvgXml;
		locache.set(key, JSON.stringify(data), 300);
		// self[key] = window._rawSvgXml;		
	}

	function initialiseChart(staffIn, buildOptions) {
		var def = $.Deferred();
		var staff = JSON.parse(JSON.stringify(staffIn)); // Deep copy - only json data
		if (typeof buildOptions === 'undefined') {
			buildOptions = {};
		}
		// Add levels to each staff based on role
		var levelRoles = getLevels();
		var locationMappings = getLocations();
		var managers = getManagers();

		$.when(levelRoles, locationMappings, managers).then(function (levels, locations, managers) {
			var result;
			if (!restoreCachedChart(buildOptions)) {
				var t0 = __getNow();
				result = buildChart(staff, locations.value, levels.value, managers.value, buildOptions);
				var t1 = __getNow();
				var timeToBuildChart = t1-t0;
				if(timeToBuildChart > 100) {
					cacheChart(buildOptions);
				}
			}
			def.resolve(result);
		});

		return def;
	}

	function transformLevel(staff, property, reverse, startMin) {
		function transform(oldMin, oldMax, newMin, newMax, oldValue) {
			var oldRange = oldMax - oldMin;
			var newRange = newMax - newMin;

			if (oldRange === 0) {
				return newMin;
			} else {
				return (((oldValue-oldMin) * newRange) / oldRange) + newMin;
			}
		}

		var lmap = staff.map(s => s[property]);
		var oldMin = Math.min.apply(null, lmap);
		var oldMax = Math.max.apply(null, lmap);
		var newMax = oldMax - oldMin;
		if (typeof startMin === 'undefined') {
			startMin = 0;
		}
		var newMin = startMin;

		if (reverse) {
			newMin = newMax;
			newMax = startMin;
		}

		staff.forEach(s => { s[property] = transform(oldMin, oldMax, newMin, newMax, s[property])});
	}

	function sortBy(a, b, properties) {
		var key;
		var result = -1;
		for(key in properties) {
			if (a[key] < b[key]) {
				result = -1 * properties[key];
				break;
			}
			if (a[key] > b[key]) {
				result = 1 * properties[key];
				break;
			}
			result = 0;
		}
		return result;
	}

	function TreePositioningAlgo(topNode) {
		var prevNode;
		var xTopAdjustment;
		var yTopAdjustment;
		var levelSeparation = 1.25;
		var maxDepth = 15;
		var siblingSeparation = 1.25;
		var subtreeSeparation = 3;
		var locationSeparation = 1.5;
		var levelNodes = { }

		function InitTree(node, topNode) {
			var lastNodeAtLevel = null;
			if (typeof levelNodes[node.normalisedLevel] === 'undefined') {
				levelNodes[node.normalisedLevel] = [];
			} else {
				lastNodeAtLevel = levelNodes[node.normalisedLevel].pop();
				lastNodeAtLevel.rightNeighborAtLevel = node;
				levelNodes[node.normalisedLevel].push(lastNodeAtLevel);	
			}
			node.leftNeighborAtLevel = lastNodeAtLevel;
			node.rightNeighborAtLevel = null;
			levelNodes[node.normalisedLevel].push(node);
			node.isLeafNode = true;

			if(topNode) {
				node.left = null;
				node.right = null;
			}

			if(node.subordinates && node.subordinates.length > 0) {
				node.isLeafNode = false;
			}

			if (!node.isLeafNode) {
				node.subordinates.sort((a,b) => {
					var sortPropOrder = {
											"locationId": 1, 
											"Level": -1, 
											"roleOrder": 1, 
											"Name": 1
										};
					return sortBy(a, b, sortPropOrder);
				});
				node.subordinates.forEach((s, i) => {
					// console.log(i);
					if (i > 0) {
						// console.log(node.subordinates[i-1].Name);
						s.left = node.subordinates[i-1];
					}
					if (i < node.subordinates.length - 1) {
						// console.log(node.subordinates[i+1].Name);
						s.right = node.subordinates[i+1];
					}
					InitTree(s);
				});
			}
		}

		// function ManagerIsInDiffCity(staff) {
		// 	var result = false;
		// 	if (Array.isArray(staff.Managers)) {				
		// 		staff.Managers.forEach(m => {
		// 			result = result || m.Location !== staff.Location;
		// 		});
		// 	}
		// 	return result;			
		// }

		function PositionTree(node) {
			if (node) {
				node.ypos = node.normalisedLevel;
				if(Array.isArray(node.subordinates)) {
					node.pos = Math.ceil(node.subordinates.length/2);
					InitTree(node, true);
	
					//Initialize the list of previous nodes at each level
					InitPrevNodeList();
	
					//Do the preliminary positioning with a postorder walk
					FirstWalk(node);	
				} else {
					node.pos = 0;
				}
				return true;
			} else {
				return false;
			}
		}

		function FirstWalk(node, leftTreePrelim) {
			var prelim;
			if (node.isLeafNode || node.normalisedLevel === maxDepth 
				// || (!node.isLeafNode && node.subordinates.length === 1 && node.subordinates[0].Location !== node.Location && Array.isArray(node.subordinates[0].Managers) && )
			) {
				if (node.left) {
					//TODO it seems sibling sep should be 0/1
					// There should be another way to calculate MeanNode size to reflect sub trees below
					if (typeof leftTreePrelim !== 'undefined') {
						prelim = Math.max(node.left.prelim, leftTreePrelim); //RM
					} else {
						prelim = node.left.prelim;
					}
					node.prelim = prelim + siblingSeparation + MeanNodeSize(node.left, node); // RM
					node.pos = node.prelim;
					return node.prelim;
				} else {
					if (typeof leftTreePrelim !== 'undefined') {
						prelim = leftTreePrelim + siblingSeparation;
					} else {
						prelim = 0;
					}
					node.prelim = prelim;
					node.pos = node.prelim;
					return node.prelim; //RM
				}
			} else {
				var leftMost = node.subordinates[0];
				var rightMost = node.subordinates[0];
				var ltPrelim = FirstWalk(leftMost, leftTreePrelim);
				while(rightMost.right) {
					if (rightMost.right.Location !== rightMost.Location && 
						( 
							(IsNullOrUndefined(rightMost.right.right) && IsNullOrUndefined(rightMost.right.rightNeighborAtLevel))
						 || (!IsNullOrUndefined(rightMost.right.right) && rightMost.right.right.Location !== rightMost.Location)
						 || (!IsNullOrUndefined(rightMost.right.rightNeighborAtLevel) && rightMost.right.rightNeighborAtLevel.Location !== rightMost.Location)
						)
					) {
						leftMost = rightMost.right;
						ltPrelim += locationSeparation;
					}
					rightMost = rightMost.right;
					ltPrelim = FirstWalk(rightMost, ltPrelim);
				}
				node.prelim = leftMost.prelim + (rightMost.prelim - leftMost.prelim) / 2;
				node.pos = node.prelim;
				return rightMost.prelim;
			}
		}

		function SecondWalk(node, modsum) {
			var result = true;
			if (node.normalisedLevel <= maxDepth) {
				var xTemp = xTopAdjustment + node.prelim + modsum;
				var yTemp = yTopAdjustment + (node.normalisedLevel * levelSeparation);
				// Check to see that xTemp and yTemp falls within drawable area
				if (CheckExtentStrange(xTemp, yTemp)) {
					node.pos = xTemp;
					node.ypos = yTemp;

					if (Array.isArray(node.subordinates)) {
						//apply the modifier value for this node to all its offspring.
						result = SecondWalk(node.subordinates[0], modsum + node.modifier);
					}

					if (result && node.right) {
						result = SecondWalk(node.right, modsum);
					}
				} else { // continuising would put the tree outside of the drawable extents range
					result = false;
				}
			} else { // we are at a level deeper than what we want to draw
				result = true;
			}
			return result;
		}

		// Complex piece try to undestand...
		function Apportion(node) {
			var leftMost = node.subordinates[0];
			//TODO perhaps here neighbor means first left most node at level above
			var neighbor = leftMost.leftNeighborAtLevel;
			var compareDepth = 1;
			var depthToStop = maxDepth - node.normalisedLevel;

			while(leftMost && neighbor && compareDepth <= depthToStop) {
				// compute the location of leftmost and where it should be with respect to neighbor
				var leftModsum = 0;
				var rightModsum = 0;
				var ancestorLeftMost = leftMost;
				var ancestorNeighbor = neighbor;
				// TODO not sure if until means < or <= depends on debugging result
				for(var i=0; i < compareDepth; i++) {
					ancestorLeftMost = ancestorLeftMost.Managers[0];
					ancestorNeighbor = ancestorNeighbor.Managers[0];
					rightModsum = rightModsum + ancestorLeftMost.modifier;
					leftModsum = leftModsum + ancestorNeighbor.modifier;				
				}
				//find the moveDistance and apply it to Node's subtree
				//add appropriate portions to smaller interior subtrees
				var moveDistance = neighbor.prelim + 
									leftModsum + 
									subtreeSeparation + 
									MeanNodeSize(leftMost, neighbor)
									- (leftMost.prelim + rightModsum);
				if (moveDistance > 0) {
					var tempPtr = node;
					var leftSiblings = 0;
					while(tempPtr && tempPtr.id !== ancestorNeighbor.id){
						leftSiblings += 1;
						tempPtr = tempPtr.left;
					}

					if (tempPtr) {
						//Apply portions to appropriate leftsibling subtrees
						var portion = moveDistance / leftSiblings;
						tempPtr = node;
						while(tempPtr.id === ancestorNeighbor.id) {
							tempPtr.prelim += moveDistance;
							tempPtr.modifier += moveDistance;
							moveDistance -= portion;
							tempPtr = tempPtr.left;
						}
					} else {
						// Don't need to move anything
						// it needs to be done by ancestor because
						// ancestorNeighbor and ancestorLeftmost are not siblings
						return;
					}
				}
				//Determine the leftmost descendant of node at the next lower level to
				//compare its positioning against that of its neighbor
				compareDepth += 1;
				if (leftMost.isLeafNode) {
					// I think 0 value here is probably wrong for level value
					// leftMost = GetLeftMost(node, 0, compareDepth);
					leftMost = GetLeftMost(node, compareDepth);
				} else {
					leftMost = leftMost.subordinates[0];
				}
			}
		}

		function GetLeftMost(node, depth) {
			if (node.normalisedLevel >= depth) {
				return node;
			} else if (node.isLeafNode) {
				return null;
			} else {
				var rightMost = node.subordinates[0];
				var leftMost = GetLeftMost(rightMost, depth);

				//Do a postorder walk of the subtree below node.
				while(leftMost && rightMost.right) {
					rightMost = rightMost.right;
					leftMost = GetLeftMost(rightMost, depth);
				}
				return leftMost;
			}
		}

		function MeanNodeSize(leftNode, rightNode) {
			return 0;
		}

		function CheckExtentStrange(xValue, yValue) {
			return true;
		}

		function InitPrevNodeList() {
			prevNode = {};
		}
		function GetPrevNodeAtLevel(level) {
			return prevNode[level];
		}

		function SetPrevNodeAtLevel(level, node) {
			prevNode[level] = node;
		}

		return PositionTree(topNode);
	}

	function AssignLocationIds (staff, locations) {
		var locationIds = {};
		locations.forEach((l, i) => locationIds[l.Title] = i);

		staff.forEach(s => {
			if(typeof locationIds[s.Location] !== 'undefined') {
				s.locationId = locationIds[s.Location];
			} else {
				s.locationId = null;
			}
		});
	}

	function buildChartBms(staff, locationMappings, levelRoles, managers, buildOptions) {
		var bestMatch;
		var subordinatesTree = [];
		var managersTree = [];
		var result = [];
		var treePositioned = false;
		if (buildOptions.bestMatchSearch) {
			bestMatch = staff.find(s => s.id === buildOptions.bestMatch.id);
			if (bestMatch) {
				bestMatch.isBestMatch = true;
				buildReportingTree(staff);

				traverse(subordinatesTree, 'subordinates', bestMatch);
				traverse(managersTree, 'Managers', bestMatch);
				result = [].concat(managersTree.filter(m => m.id !== bestMatch.id), subordinatesTree);

				// Role mapping
				result.forEach(s => {
					s.Level = -2;
					s.roleOrder = null;
					if (s.Role) {
						var roleObj = levelRoles.find(r => r.Title.toLowerCase().trim() === s.Role.toLowerCase().trim());
						if (roleObj) {
							s.Level = +roleObj.ocr_level;
							s.roleOrder = +roleObj.ocr_order;
						} else {
							console.log( 'Can not find role: '+s.Role+' for user '  + s.Name)
						}
					} else {
						console.log('User ' + s.Name + ' does not have any role assigned.')
					}

					if (s.Level === -1 && Array.isArray(s.Managers)) {
						var subo = s.subordinates;
						var ms = s.Managers;
						s.subordinates = undefined;
						s.Managers = undefined;
						ms.forEach(mFrmA => {
							var manager = staff.find(m => m.id == mFrmA.id);
							if (manager) {
								manager.Assistant = jQuery.extend(true, {}, s);
								manager.Assistant.IsAssistant = true;
							}
						});
						s.subordinates = subo;
						s.Managers = ms;
					}
				});				
				// Remove staff whose role can not be found;
				result = result.filter(s => s.roleOrder !== null);

				// Assign assistants to managers
				managersTree.forEach(m => {
					if (m.id !== bestMatch.id && Array.isArray(m.subordinates)) {
						var assistant = m.subordinates.find(sb => sb.Level === -1);
						if (typeof assistant === 'undefined') {
							m.subordinates.forEach(s => {
								if (typeof s.Level === 'undefined' || s.Level === "") {
									s.Level = -2;
									s.roleOrder = null;
									if (s.Role) {
										var roleObj = levelRoles.find(r => r.Title.toLowerCase().trim() === s.Role.toLowerCase().trim());
										if (roleObj) {
											s.Level = +roleObj.ocr_level;
											s.roleOrder = +roleObj.ocr_order;
										} else {
											console.log( 'Can not find role: '+s.Role+' for user '  + s.Name)
										}
									} else {
										console.log('User ' + s.Name + ' does not have any role assigned.')
									}
				
									if (s.Level === -1 && Array.isArray(s.Managers)) {
										assistant = s;
									}										
								}
							});								
						}

						if (typeof assistant !== 'undefined') {
							// add assistant
							var subo = assistant.subordinates;
							var ms = assistant.Managers;
							assistant.subordinates = undefined;
							assistant.Managers = undefined;

							m.Assistant = jQuery.extend(true, {}, assistant);
							m.Assistant.IsAssistant = true;
					
							assistant.subordinates = subo;
							assistant.Managers = ms;
						}
					}
				});
				
				// If best match is an Assistant truncate all it's subordinates
				if (bestMatch.Level === -1 && !Array.isArray(bestMatch.subordinates)) {
					// var ms = bestMatch.Managers;
					// if (Array.isArray(ms)) {
					// 	bestMatch.subordinates = undefined;
					// 	bestMatch.Managers = undefined;
					// 	ms.forEach(m => {
					// 		m.Assistant = jQuery.extend(true, {}, bestMatch);
					// 	});
					// 	result = ms;
					if (Array.isArray(bestMatch.Managers)) {
						result = bestMatch.Managers;
					} else {
						result = [bestMatch];
					}
				} else {
					// when best match is not an assistant
					// and
					if (!Array.isArray(bestMatch.Managers)  // does not have manager
						&& Array.isArray(bestMatch.subordinates) // has only one subordinate which is assistant
						&& bestMatch.subordinates.length === 1 
						&& bestMatch.subordinates[0].Level === -1) {
							var assistant = bestMatch.subordinates[0];
							assistant.Managers = undefined;
							assistant.Manager = bestMatch.id;
							assistant.subordinates = undefined;
							bestMatch.Assistant = jQuery.extend(true, {}, assistant);
							result = [bestMatch];
					} else if (!Array.isArray(bestMatch.Managers)  // does not have manager
								&& !Array.isArray(bestMatch.subordinates) // does not have subordinates
							) {						
						result = [bestMatch];
					} else {
						// if (Array.isArray(bestMatch.subordinates)) {
						// 	// find assistant for best match if bm is not assistant or support staff
						// 	var assistant = bestMatch.subordinates.find(sb => sb.Level === -1);
						// 	if (assistant) {
						// 		// below dirty coding to solve too much recursion issue
						// 		var subo = assistant.subordinates;
						// 		var ms = assistant.Managers;
						// 		assistant.subordinates = undefined;
						// 		assistant.Managers = undefined;
						// 		assistant.IsAssistant = true;
						// 		bestMatch.Assistant = jQuery.extend(true, {}, assistant);
						// 		result = result.filter(r => r.id !== assistant.id);
						// 	}
						// }

						//for support staff
						if (!Array.isArray(bestMatch.subordinates) && Array.isArray(bestMatch.Managers) && bestMatch.Managers[0].Level === -1){
							bestMatch.Managers.forEach(m => {if(m.Level === -1) { m.Level = 1}});
						}

						// TODO: Remove assistants till figure out multiple managers case...
						result = result.filter(s => s.Level !== -1 
													|| (s.Level === -1 && Array.isArray(s.subordinates))
												);
						result.forEach(r => {
							if (r.Level === -1) {
								r.Level = 1;
							}
						});
						
						result.forEach(s => s.subordinates = undefined);
						buildReportingTree(result);

						var withMultipleMs = result.filter(s => {return Array.isArray(s.Managers)  && s.Managers.length > 1});
						// var withMultipleMs;
						if (withMultipleMs.length) {					
							// this case is not handled yet
							console.log('Multiple managers detected in tree of', bestMatch.Name);
							// result = [bestMatch];							
						} else {
						} // move

						// copied code - start
						var normalisationTree = [];
						normaliseLevels(normalisationTree, 0, bestMatch);
						result = result.filter(r => typeof r.normalisedLevel !== 'undefined');
						reassignNormalisedLevels(result);
						// transformLevel(result, 'normalisedLevel');
						AssignLocationIds(result, locationMappings);
						result.sort((a, b) => {var p = {"normalisedLevel": 1}; return sortBy(a, b, p);});

						// not part of copied code - start
						if (withMultipleMs.length) {
							withMultipleMs.forEach(wmms => {
								wmms.Managers.sort((a, b) => {
									var sortPropOrder = {
										"locationId": 1,
										"Level": -1,
										"roleOrder": 1,
										"Name": 1
									};
									return sortBy(a, b, sortPropOrder);
								});
								var mAssigned = false;
								wmms.Managers.forEach((m, i) => {																
									if (mAssigned || m.Location !== wmms.Location) {
										m.subordinates = m.subordinates.filter(sb => sb.id !== wmms.id);
									}
									if (!mAssigned && m.Location === wmms.Location) {
										mAssigned = true;
										wmms.primaryManagerIndex = i;
									}
								});
							});
						}
						// not part of copied code - end
						var multipleAtLevel0 = result.filter(r => !Array.isArray(r.Managers));
						var level0;

						if (multipleAtLevel0.length > 1) {
							level0 = {isLeafNode: false, left: null, normalisedLevel: -1, subordinates: multipleAtLevel0 };
						} else {
							level0 = result[0];
						}

						// result[0].rootNode = true;
						treePositioned = TreePositioningAlgo(level0);

						lmap = { };
						result.forEach(s => {
							if (typeof lmap[s.Level] === 'undefined') {
								lmap[s.Level] = [];
							}
							lmap[s.Level].push(s.normalisedLevel);
						});

						for(var key in lmap) {
							lmap[key].sort((a, b) => b-a);
						}

						result.sort((a, b) => {
							var sortPropOrder = {
								"Level": -1,
								"normalisedLevel": 1
							};
							return sortBy(a, b, sortPropOrder)
						});
						
						var cStaff;
						var pStaff;
						var levelShift = 0;
						for(var i=0; i < result.length; i++) {
							cStaff = result[i];
							if (i > 0) {
								pStaff = result[i-1];
								if (pStaff.Level === cStaff.Level && pStaff.normalisedLevel < cStaff.normalisedLevel) {
									levelShift--;
								}
								if(pStaff.Level-cStaff.Level > 1) {
									levelShift += (pStaff.Level-cStaff.Level-1);
								}
							}
							cStaff.levelShift = levelShift;
						}
						result.forEach(r => r.Level += r.levelShift);
						transformLevel(result, 'Level', true, 0);
						transformLevel(result, 'pos', false, 0);

						var assistants = [];
						result.forEach(r => {
							if (typeof r.Assistant !== 'undefined') {
								var assistant = r.Assistant;
								assistant.Level = r.Level;
								assistant.pos = (r.pos / 1.25 + 1) * 1.25;
								assistants.push(assistant);
							}
						});
						AssignLocationIds(assistants, locationMappings);
						result = result.concat(assistants);

						var inResultLocations = _.uniq(result.map(r => r.locationId));
						inResultLocations.sort((a, b) => {
							return a - b;
						});
						inResultLocations.forEach((lid, i) => {
							var staffInLoc = result.filter(r => r.locationId === lid).sort((a, b) => {
								var sortPropOrder = {
									"pos": 1	
								};
								return sortBy(a, b, sortPropOrder);
							});
							locationMappings[lid].StartPos = staffInLoc[0].pos;
							locationMappings[lid].EndPos = staffInLoc[staffInLoc.length-1].pos;

							if(i > 0) {
								var cLoc = locationMappings[lid];
								var pLoc = locationMappings[inResultLocations[i-1]];
								if (cLoc.StartPos > pLoc.StartPos && cLoc.StartPos < pLoc.EndPos) {
									delete cLoc.StartPos;
									delete cLoc.EndPos;
								}
							}
						});

						// if (typeof bestMatch.Assistant !== 'undefined') {
						// 	var assistant = bestMatch.Assistant;
						// 	assistant.Level = bestMatch.Level;
						// 	assistant.pos = (bestMatch.pos / 1.25 + 1) * 1.25;
						// 	result.push(assistant);
						// }

						result.forEach(r => {
							r.SubLevel = 0;
							r.SubLevelOffset = 0;
						});
						// copied code - end
					}
				}

			} else {
				result = [];
			}
		}
		return {staff: result, treePositioned};
	}

	function buildChartNonBms(staff, locationMappings, levelRoles, managers, buildOptions) {
		const locationSeparation = 1.5;
		var myStaff = [].concat(staff);
		var levelStaff = { };
		var locationStaff = { };
		function init() {
			transformLevel(myStaff, "Level", true, 0);
			AssignLocationIds(myStaff, locationMappings);

			myStaff.sort((a,b) => {
				var sortPropOrder = {
					"locationId": 1,
					"Level": 1,
					"roleOrder": 1,
					"Name": 1
				};
				return sortBy(a, b, sortPropOrder);
			});

			var pushIn2DArray = (inputArray, dim1, dim2, element) => {
				if(typeof element[dim1] !== 'undefined' && typeof element[dim2] !== 'undefined') {
					if(typeof inputArray[element[dim1]] === 'undefined') {
						inputArray[element[dim1]] = { };
					}
					if(typeof inputArray[element[dim1]][element[dim2]] === 'undefined') {
						inputArray[element[dim1]][element[dim2]] = [];
					}
					inputArray[element[dim1]][element[dim2]].push(element);
				}
			};

			myStaff.forEach((s, i) => {
				pushIn2DArray(locationStaff, 'locationId', 'Level', s);
				pushIn2DArray(levelStaff, 'Level', 'locationId', s);
			});
			return {levelStaff, locationStaff};
		}

		function GetLocationMinMaxPos() {
			var startPos = 0;
			locationStaff.forEach((location) => {
				location.minPos = startPos;				
				var staffLength = [];
				var level;				
				for(level in location){
					var levelStaff = location[level];
					staffLength.push(levelStaff.length);
				}
				var maxLevelLength = Math.max.apply(null, staffLength);
				if(maxLevelLength >= 15) {
					maxLevelLength = 14;
				}
				if (maxLevelLength > 1 && maxLevelLength < 15) {
					maxLevelLength--;
				}
				location.maxPos = startPos + maxLevelLength;
				startPos = maxLevelLength + locationSeparation;	
			});
		}
		return {init};
	}

	function buildChart(staff, locationMappings, levelRoles, managers, buildOptions) {
		var bmsResult = {};
		var allStaff = [];
		
		// Assign a level on each person based on the role
		// HG: to assign levels more efficiently
		if (typeof buildOptions.bestMatchSearch === 'undefined' || buildOptions.bestMatchSearch === false) {
			staff.forEach(s => {
				s.Level = -2;
				s.roleOrder = null;
				if (s.Role) {
					var roleObj = levelRoles.find(r => r.Title.toLowerCase().trim() === s.Role.toLowerCase().trim());
					if (roleObj) {
						s.Level = +roleObj.ocr_level;
						s.roleOrder = +roleObj.ocr_order;
					} else {
						console.log( 'Can not find role: '+s.Role+' for user '  + s.Name)
					}
				} else {
					console.log('User ' + s.Name + ' does not have any role assigned.')
				}
	
				// Add assistants to managers
				if (s.Level === -1) {
					// if (buildOptions.adminSearch) {
					// 	s.Level = 1;
					// }
					if ((typeof buildOptions.bestMatchSearch === 'undefined' || buildOptions.bestMatchSearch === false) && Array.isArray(s.Managers)) {
						if (Array.isArray(s.Managers)) {
							s.Managers.forEach(mFrmA => {
								var manager = staff.find(m => m.id == mFrmA.id);
								if (manager) {
									manager.Assistant = jQuery.extend(true, {}, s);
								}
							});
						}
					}
					s.Level = 1;
				}
			});	
			//HG: Remove below line only for UAT
			staff = staff.filter(s => s.roleOrder !== null || s.Level === -1)
		} else {
			bmsResult = buildChartBms(staff, locationMappings, levelRoles, managers, buildOptions);
			staff = bmsResult.staff;
		}

		if (bmsResult.treePositioned) {
			// not sure if any other transforms required.
			allStaff = staff;
		} else {
			transformLevel(staff, "Level", true, 0);
			// HG: end Modified code

			// Order all staff based on role
			// HG: more efficient Code
			staff.sort((a,b) => {
				var sortPropOrder = {"roleOrder": 1};
				return sortBy(a, b, sortPropOrder);
			});
			// HG: end more efficient Code

			// Separate out staff based on location
			var locationStaff = {};

			for (var i = 0; i < staff.length; i++) {
				if (typeof locationStaff[staff[i].Location] == 'undefined') {
					locationStaff[staff[i].Location] = [];
				}

				locationStaff[staff[i].Location].push(staff[i]);
			}

			// Get the highest level
			var highestLevel = 0;
			for (var i = 0; i < staff.length; i++) {
				if (staff[i].Level > highestLevel) {
					highestLevel = staff[i].Level;
				}
			}

			allStaff = [];

			var highestPos = 0;

			for (var lc = 0; lc < locationMappings.length; lc++) {
				locationMappings[lc].StartPos = highestPos;
				var locStaff = locationStaff[locationMappings[lc].Title];

				if (typeof locStaff === 'undefined') continue; // There are no staff for this location

				var currStaff = orderStaff(locStaff, highestLevel, buildOptions.bestMatchSearch);
				var nextHighest = highestPos;

				// Normalise the edges (Make sure the minimum positioned element in the tree is 0, no more, no less)
				var minOffset = null;
				//HG below code is trying to find min position out of current staff array
				minOffset = Math.min.apply(null, currStaff.map(cs => cs.pos));

				for (var i = 0; i < currStaff.length; i++) {
					currStaff[i].pos += (highestPos - minOffset);

					if (currStaff[i].pos > nextHighest) {
						nextHighest = currStaff[i].pos;
					}
				}

				// Handle sub levels on a per location basis
				var subLevelOffset = 0;
				for (var lx = 0; lx < MAXLEVELS; lx++) {
					var currMaxSubLevel = 0;

					for (var i = 0; i < currStaff.length; i++) {
						if (currStaff[i].Level != lx) continue;
						if (currStaff[i].SubLevel > currMaxSubLevel) { 
							currMaxSubLevel = currStaff[i].SubLevel;
						}

						currStaff[i].SubLevelOffset = subLevelOffset + currStaff[i].SubLevel;
					}
					subLevelOffset += currMaxSubLevel;
				}

				if ((nextHighest - highestPos) < 2) {
					highestPos = nextHighest + 2.5;
					locationMappings[lc].EndPos = nextHighest + 1;
				} else {
					highestPos = nextHighest + 1.5;
					locationMappings[lc].EndPos = nextHighest;
				}

				allStaff = allStaff.concat(currStaff);
			}
		}

		if (allStaff.length) {
			renderChart(allStaff, locationMappings, bmsResult.treePositioned);
			return true;			
		} else {
			return false;
		}
	}
	self.initialiseChart = initialiseChart;

	return self;
}


// Card - customised for WTP

function Card(draw, obj, locationMappings) {
	var self = this;
	self.isDrawn = false;
	self.x = undefined;
	self.y = undefined;
	self.locationMappings = locationMappings;

	var fontFamily = 'PT Sans'; // for WTP, this will be PT Sans

	// settings for title
	var titleWeight = "bold";
	var titleSize = "14";

	// settings for role
	var roleWeight = "normal";
	var roleSize = "12";

	// card sizing
	var rectWidth = 120;
	var rectHeight = 88;

	// image sizing & padding
	var imgW = 50;
	var imgH = 50;
	var imgPaddingX = 0;

	// variables to hold SVG elements
	var draw, rect, circle, clip, image, title, role, group;

	self.getLocationMapping = function (location) {
		for (var i = 0; i < self.locationMappings.length; i++) {
			if (self.locationMappings[i].Title == location) return self.locationMappings[i];
		}

		return { ocl_bg: "#000", ocl_title: "#FFF", ocl_role: "#FFF" };
	}

	//# DRAW
	self.draw = function () {
		if (self.isDrawn) return;

		var x = self.x + 20;
		var y = self.y + 40;

		// container!
		group = draw.group()

		var locMapping = self.getLocationMapping(obj.Location);
		titleColour = locMapping.ocl_title;
		roleColour = locMapping.ocl_role;

		// Rectangle - card outline & background
		rect = group.rect(rectWidth, rectHeight)
			.move(x, y)
			.attr({ fill: locMapping.ocl_bg });

		if(obj.IsAssistant) {
			var horizontal = { 
				start: {x: x, y: y + 44},
				end: {x: x-20, y: y + 44}
			};
			var vertical = {
				start: {x: x-20, y: y + 45},
				end: {x: x-20, y: y - 52}				
			}
			group.line(horizontal.start.x, horizontal.start.y, horizontal.end.x, horizontal.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
			group.line(vertical.start.x, vertical.start.y, vertical.end.x, vertical.end.y).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
		}

		if (typeof obj.isBestMatch !== 'undefined' && obj.isBestMatch === true) {
			group.line(x, y, x, y + 87).stroke({ width: 2 }).attr({ stroke: 'black' });
			group.line(x+120, y, x+120, y + 87).stroke({ width: 2 }).attr({ stroke: 'black' });
			group.line(x-1, y+87, x+121, y + 87).stroke({ width: 2 }).attr({ stroke: 'black' });
		}

		// profile image
		profileImg = group.image(_spPageContextInfo.siteAbsoluteUrl
			+ "/style library/nit.intranet/img/profile-placeholder.png?RenditionID=6", imgW, imgH).move(x + 35, y - 35);
		image = group.image(_spPageContextInfo.siteAbsoluteUrl
			+ "/Staff Directory Photo Cache/" + obj.Email + ".JPG?RenditionID=6", imgW, imgH).hide().move(x + 35, y - 35).loaded(function (loader) {
				this.show();
				profileImg.hide();
			});

		// title
		var textGroup = group.group();
		title = textGroup.text(function (add) {
			add.tspan(obj.Name).fill(titleColour).newLine()
		})
			.font({ family: fontFamily, size: titleSize, anchor: 'middle', leading: '0em', weight: titleWeight });

		// role
		var shortRole = obj.Role.replace("and", "&");
		var roleLine1 = textGroup.text(function (add) {
			add.tspan(shortRole).fill(roleColour).newLine()
		})
			.font({ family: fontFamily, size: roleSize, anchor: 'middle', leading: '0em', weight: roleWeight }).move(0, 4);
		var roleLine2 = null;
		var roleLine3 = null;
		var line2 = null;

		var maxLastIndex = shortRole.length;
		var maxPerLine = 110;
		var line2Remaining = "";

		if (title.node.getComputedTextLength() > maxPerLine) {
			// Update title text
			title.node.removeChild(title.node.lastChild);
			title.text(function (add) {
				add.tspan(obj.Name[0] + ". " + obj.Name.substring(obj.Name.indexOf(" ") + 1)).fill(titleColour).newLine()
			});
		}

		while (roleLine1.node.getComputedTextLength() > maxPerLine) {
			if (roleLine2 == null) {
				roleLine2 = textGroup.text("text")
					.font({ family: fontFamily, size: roleSize, anchor: 'middle', leading: '0em', weight: roleWeight })
					.move(0, 19);
			}

			var line1 = shortRole.substring(0, shortRole.substring(0, maxLastIndex).trim().lastIndexOf(" ")).trim();
			maxLastIndex = line1.length - 1;
			var line2 = shortRole.substring(line1.length).trim();
			var line2Remaining = line2;

			// Update role line 1
			roleLine1.node.removeChild(roleLine1.node.lastChild);
			roleLine1.text(function (add) {
				add.tspan(line1).fill(roleColour).newLine()
			});

			// Update role line 2
			roleLine2.node.removeChild(roleLine2.node.lastChild);
			roleLine2.text(function (add) {
				add.tspan(line2).fill(roleColour).newLine()
			});
		}

		maxLastIndex = line2Remaining.length;

		while (roleLine2 != null && roleLine2.node.getComputedTextLength() > maxPerLine) {
			if (roleLine3 == null) {
				roleLine3 = textGroup.text("text")
					.font({ family: fontFamily, size: roleSize, anchor: 'middle', leading: '0em', weight: roleWeight })
					.move(0, 34);
			}

			var line2 = line2Remaining.substring(0, line2Remaining.substring(0, maxLastIndex).trim().lastIndexOf(" ")).trim();
			maxLastIndex = line2.length - 1;
			var line3 = line2Remaining.substring(line2.length).trim();

			// Update role line 2
			roleLine2.node.removeChild(roleLine2.node.lastChild);
			roleLine2.text(function (add) {
				add.tspan(line2).fill(roleColour).newLine()
			});

			// Update role line 3
			roleLine3.node.removeChild(roleLine3.node.lastChild);
			roleLine3.text(function (add) {
				add.tspan(line3).fill(roleColour).newLine()
			});
		}

		if (roleLine3 != null) {
			textGroup.move(x + 60, y + 5 + 28);
		} else if (roleLine2 != null) {
			textGroup.move(x + 60, y + 5 + 36);
		} else {
			textGroup.move(x + 60, y + 5 + 40);
		}

		group.attr({ 'style': 'cursor: pointer;' })

		group.on('mousedown', function (e) {
			self.mousedown = e;
		});

		group.on('click', function (e) {
			if (Math.abs(self.mousedown.clientX - e.clientX) < 5 &&
				Math.abs(self.mousedown.clientY - e.clientY) < 5) {
				if (typeof (self.onClick) === 'function') {
					self.onClick(e, obj);
				}
			}
		});
		self.isDrawn = true;
	}

	//# REMOVE
	self.remove = function () {
		if (!self.isDrawn) return;

		self.isDrawn = false;
		group.off('click');
		group.off('mouseover');
		group.off('mouseout');
		group.remove();
	}

	//# ONCLICK
	self.onClick = function () { }; // can be overwritten!

	return self;
}
