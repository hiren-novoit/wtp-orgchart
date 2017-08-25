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
		managersCacheList: 'Organisational Chart Managers'
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

	function sortByRoleAndName(a, b) {
		var roleOrder = (a.Level * 100 + a.roleOrder) - (b.Level * 100 + b.roleOrder);
		if (roleOrder === 0) {
			if(a.Name < b.Name) return -1;
			if(a.Name > b.Name) return 1;
			return 0;
		} else {
			return roleOrder;
		}
	}

	function traverse(t, direction, current, staff) {
		// console.log(current.id, current.prev);
		// console.log(t.length);
		// if (typeof current.traversed === 'undefined') {
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
		// }
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

	// function orderStaff(staff, highestLevel, bestMatchSearch) {
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

		// Fix staff whose manager doesn't exist in the current context (Remove their manager)
		// Fix staff whose manager is on the same or lower level as them (Remove their manager)
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Manager != -1) {
				var parent = getParent(staff, staff[i]);

				if (parent == null || parent.Level >= staff[i].Level) staff[i].Manager = -1;
			}
		}

		var overlay = [];

		// All staff that have a negative level are actually to be laid over the top next to the exec's later.
		for (var i = staff.length - 1; i >= 0; i--) {
			if (staff[i].Level == -1) {
				overlay.push(staff[i]);
				staff.splice(i, 1);
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

		// Separate out all of the trees
		var trees = [];
		// HG Optimized code
		// find & push staff in subordinates property of the manager
		staff.forEach((s) => {
			// console.log(s.id, s.Manager);
			if(s.Manager !== -1) {
				var manager = staff.find(m => s.Manager === m.id);
				if (typeof manager !== 'undefined') { 
					// console.log('Manager found.')
					if (typeof manager.subordinates === 'undefined') {
						// console.log('Created sub o obj')
						manager.subordinates = {};
					}					
					manager.subordinates[s.id] = s;
					s.pushedIntoTree = true;
				}
			}
		});
		_.remove(staff, (s) => typeof s.pushedIntoTree !== 'undefined');
		function traverse(t, s, manager) {
			// console.log(s.id, s.Manager);
			t.push(s);
			// console.log(t.length);
			if(s.subordinates) {
				for(var subKey in s.subordinates){
					traverse(t,s.subordinates[subKey], s)
					// console.log(t.length);
				}
			}
		}
		var s;
		for(s in staff) {
			var t = [];
			traverse(t, staff[s]);
			trees.push(t);
		}// end HG Optimized code

		// end extract out all managers from staff array
		// while (staff.length > 0) {
		// 	for (var i = staff.length - 1; i >= 0; i--) {
		// 		var curr = staff[i];
		// 		if (curr.Manager == -1) {
		// 			trees.push([curr]);
		// 			staff.splice(i, 1);
		// 			continue;
		// 		}

		// 		var treeIndex = -1;

		// 		for (var x = 0; x < trees.length; x++) {
		// 			for (var y = 0; y < trees[x].length; y++) {
		// 				if (trees[x][y].id == curr.Manager) {
		// 					treeIndex = x;
		// 				}
		// 			}
		// 		}

		// 		if (treeIndex != -1) {
		// 			trees[treeIndex].push(curr);
		// 			staff.splice(i, 1);
		// 		}
		// 	}
		// }

		// Keep track of the position of trees / free elements
		var allStaff = [];

		var levelMaxPos = [];
		for (var i = 0; i < MAXLEVELS * MAXSUBLEVELS; i++) {
			levelMaxPos.push(0);
		}

		var startOffset = 0;
		gapFillers.sort(sortByRoleAndName);
		trees.forEach(t => t.sort(sortByRoleAndName));
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
				assistant.pos = levelMaxPos[assistant.Level * MAXSUBLEVELS + assistant.SubLevel]++;
				gapFillers.push(assistant);
			}

			if (gapFillers[i].pos + 0.5 > startOffset) {
				startOffset = gapFillers[i].pos + 0.5;
			}
		}

		centerAlignStaff(gapFillers);
		allStaff = allStaff.concat(gapFillers);

		// Build out the trees
		for (var i = 0; i < trees.length; i++) {
			buildTree(trees[i]);

			// Push out all items in the current tree by the minPosStart amount
			for (var x = 0; x < trees[i].length; x++) {
				//trees[i][x].pos += minPosStart;
				trees[i][x].pos += startOffset;
			}

			for (var x = 0; x < trees[i].length; x++) {
				if ((trees[i][x].pos + 0.5) > startOffset) {
					startOffset = trees[i][x].pos + 0.5;
				}
			}

			// Add back into a single array
			allStaff = allStaff.concat(trees[i]);
		}

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

	function getParent(staff, curr) {
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].id == curr.Manager) {
				return staff[i];
			}
		}

		return null;
	}

	function getStartingPos(staff, currStaff) {
		// First, check the parent
		var parent = getParent(staff, currStaff);
		var parentPos = parent.pos - parent.childOffset;
		// Now check the sibling
		var largePos = -1;
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Level == currStaff.Level) {
				if ((staff[i].pos + 1) > largePos) largePos = (staff[i].pos + 1);
			}
		}

		return Math.max(parentPos, largePos);
	}

	function buildTree(staff) {
		// Now, starting at the top of the tree, start positioning based on the children, then correct parents as needed
		var posLeftOffset = 0;

		var minLevel = 99999;
		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Level < minLevel && staff[i].Level != -1) {
				minLevel = staff[i].Level;
			}
		}

		for (var y = 0; y <= MAXLEVELS; y++) {
			var currentLevelOffset = 0;

			for (var i = 0; i < staff.length; i++) {
				var currStaff = staff[i];

				if (currStaff.Level != y) continue;

				if (y == minLevel) {
					// There really isn't much on this level, so just position the elements in the middle of the children below
					var childrenCount = countMaxChildrenSameLevel(staff, currStaff.id);
					if (childrenCount <= 1) {
						currStaff.pos = 0;
					} else {
						currStaff.pos = childrenCount / 2;
						currStaff.childOffset = childrenCount / 2;
					}
				} else {
					currStaff.pos = getStartingPos(staff, currStaff);
					traverseUpTree(staff, currStaff);
				}
			}
		}
	}

	function traverseUpTree(staff, currStaff) {
		var currManagerId = currStaff.Manager;

		while (currManagerId != -1) {
			for (var i = 0; i < staff.length; i++) {
				var curr = staff[i];
				if (curr.id == currManagerId) {
					// Get curr children positions
					var smallPos = -1;
					var largePos = 0;
					var count = 0;
					for (var x = 0; x < staff.length; x++) {
						if (staff[x].Manager == currManagerId) {
							if (staff[x].pos != -1 && (staff[x].pos < smallPos || smallPos == -1)) {
								smallPos = staff[x].pos;
							}
							if (staff[x].pos != -1 && (staff[x].pos > largePos || largePos == -1)) {
								largePos = staff[x].pos;
							}
							count++;
						}
					}

					var prevPos = curr.pos;

					// Update position relative to children
					curr.pos = smallPos + (largePos - smallPos) / 2;

					// Make sure everything on the right moves over
					var past = false;
					for (var x = 0; x < staff.length; x++) {
						if (past && staff[x].pos != -1 && staff[x].Level == curr.Level) {
							staff[x].pos += curr.pos - prevPos;
						}
						if (staff[x].id == curr.id) {
							past = true;
						}
					}

					currManagerId = curr.Manager;
				}
			}
		}
	}

	function traverseRight(staff, currStaff) {
		// Go through siblings on the right

		for (var x = 0; x < staff.length; x++) {
			if (staff[x].Level == curr.Level && staff[x].pos > prevPos) {
				staff[x].pos = getStartingPos(staff, staff[x]);
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

	function countMaxChildrenSameLevel(staff, id) {
		var levels = [];

		for (var i = 0; i <= MAXLEVELS; i++) {
			levels.push(0);
		}

		var highestLevelCount = 0;

		for (var i = 0; i < staff.length; i++) {
			if (staff[i].Manager == id && staff[i].Level > 0) {
				levels[staff[i].Level]++;

				if (levels[staff[i].Level] > highestLevelCount) {
					highestLevelCount = levels[staff[i].Level];
				}
			}
		}

		return highestLevelCount;
	}

	function renderChart(staff, locationMappings) {
		var draw = SVG(config.target);
		var t0 = __getNow();

		var fontFamily = 'PT Sans'; // for WTP, this will be PT Sans

		// settings for title
		var titleWeight = "bold";
		var titleSize = "36";

		for (var i = 0; i < locationMappings.length; i++) {
			var loc = locationMappings[i];
			var rect = draw.rect(((loc.EndPos - loc.StartPos + 1) * 140) - 20, 60)
				.move(loc.StartPos * 140 + 20, 10)
				.attr({ fill: loc.ocl_bg });

			var locText = draw.text(function (add) {
				add.tspan(loc.Title.toUpperCase()).fill(loc.ocl_title)
			}).font({ family: fontFamily, size: titleSize, anchor: 'middle', leading: '0em', weight: titleWeight });

			var locTextLen = locText.node.getComputedTextLength();
			locText.move(loc.StartPos * 140 + 30 + (locTextLen / 2), 20);
		}

		var topOffset = 100;
		// staff.sort((a, b) => { return (a.Level * 10 + a.SubLevel)-(b.Level * 10 + b.SubLevel); });
		// var assistantCorrection = 0;
		// var nextLevelAssistantCorrection = null;
		// var currentSublevel;
		// if (staff.length) {
		// 	currentSublevel = staff[0].Level * 10 + staff[0].SubLevel;
		// }
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
				assistantOffset[i] = 60;
			}
		});
		assistantOffset.forEach( (ao, i) => {
			if (i > 0) {
				assistantOffset[i] += assistantOffset[i-1]
			}
		});
		for (var i = 0; i < staff.length; i++) {
			// if (currentSublevel < (staff[i].Level * 10 + staff[i].SubLevel)) {
			// 	currentSublevel = staff[i].Level * 10 + staff[i].SubLevel;
			// 	assistantCorrection = nextLevelAssistantCorrection;
			// 	nextLevelAssistantCorrection = null;
			// }
			var curr = staff[i];

			var x = 140 * curr.pos;
			var y = topOffset + (200 * curr.Level) + (staff[i].SubLevelOffset * 140) + assistantOffset[curr.Level * MAXLEVELS + curr.SubLevel];
			// var y = topOffset + (200 * curr.Level) + (staff[i].SubLevelOffset * 140) + assistantCorrection;
			if (curr.IsAssistant) {
				y += 60;
				x -= 10;
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

		var t1 = __getNow();
		window.console && console.log('NITOrgChart::buildChart took ' + (t1 - t0) + ' milliseconds');
	}

	function getStaffPerLevel(staff) {
		var staffPerLevel = [];
		for (var i = 0; i < MAXLEVELS; i++) {
			staffPerLevel[i] = 0;
		}

		for (var i = 0; i < staff.length; i++) {
			staffPerLevel[staff[i].Level]++;
		}

		return staffPerLevel;
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
			var bmCard = buildChart(staff, locations.value, levels.value, managers.value, buildOptions);
			def.resolve(bmCard);
		});

		return def;
	}

	function incrLevelForManagersBy(amount, subordinate) {
		if (Array.isArray(subordinate.Managers)) {
			subordinate.Managers.forEach(m => {
				m.Level += amount;
				incrLevelForManagersBy(amount, m);
			});
		}
	}

	function transformLevel(oldMin, oldMax, newMin, newMax, oldValue) {
		var oldRange = oldMax - oldMin;
		var newRange = newMax - newMin;

		if (oldRange === 0) {
			return newMin;
		} else {
			return (((oldValue-oldMin) * newRange) / oldRange) + newMin;
		}
	}

	function buildChartBms(staff, locationMappings, levelRoles, managers, buildOptions) {
		// buildReportingTree(staff);
		var bestMatch;
		var subordinatesTree = [];
		var managersTree = [];
		var result = [];
		if (buildOptions.bestMatchSearch) {
			bestMatch = staff.find(s => s.id === buildOptions.bestMatch.id);
			if (bestMatch) {
				bestMatch.isBestMatch = true;
				buildReportingTree(staff);

				traverse(subordinatesTree, 'subordinates', bestMatch);
				traverse(managersTree, 'Managers', bestMatch);

				result = [].concat(managersTree.filter(m => m.id !== bestMatch.id), subordinatesTree);
////
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
				});

				// If best match is an Assistant truncate all it's subordinates
				if (bestMatch.Level === -1) {
					// var subIds = [];
					// subIds = subordinatesTree.map(sb => sb.id);
					// staff = staff.filter(s => subIds.indexOf(s.id) < 0);
					var ms = bestMatch.Managers;				
					if (Array.isArray(ms)) {
						bestMatch.subordinates = undefined;
						bestMatch.Managers = undefined;
						ms.forEach(m => {
							m.Assistant = jQuery.extend(true, {}, bestMatch);
						});
						result = ms;
					} else {
						result = bestMatch;
					}
					// buildOptions.bestMatchSearch = false;
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
					} else if (true) { // TODO remove once best match search is ready
						result = [];
					} else {
						// find assistant for best match if bm is not assistant or support staff
						if (bestMatch.Level !== -1 && Array.isArray(bestMatch.subordinates)) {
							var assistant = bestMatch.subordinates.find(sb => sb.Level === -1);
							if (assistant) {
								// below dirty coding to solve too much recursion issue
								var subo = assistant.subordinates;
								var ms = assistant.Managers;
								assistant.subordinates = undefined;
								assistant.Managers = undefined;
								bestMatch.Assistant = jQuery.extend(true, {}, assistant);
								// assistant.subordinates = subo;
								// //remove best match from assistants managers list
								// assistant.Managers = ms.filter(m => m.id === bestMatch.id);
							}

							// Remove assistants
							// staff = staff.filter(s => s.id === assistant.id || s.Level !== -1);
							staff = staff.filter(s.Level !== -1);
						}
						staff.forEach(s => s.subordinates = undefined);
						buildReportingTree(staff);


						var normalisationTree = [];
						normaliseLevels(normalisationTree, 0, bestMatch);

						// var lmap = staff.map(s => { return {level: s.Level, normalisedLevel: s.normalisedLevel}});
						var lmap = staff.map(s => s.normalisedLevel);
						var oldMin = Math.min.apply(null, lmap);
						var oldMax = Math.max.apply(null, lmap);
						var newMax = oldMax - oldMin;
						var newMin = 0;

						staff.forEach(s => { s.normalisedLevel = transformLevel(oldMin, oldMax, newMin, newMax, s.normalisedLevel)})

						lmap = { };
						staff.forEach(s => {
							if (typeof lmap[s.Level] === 'undefined') {
								lmap[s.Level] = [];
							}
							lmap[s.Level].push(s.normalisedLevel);
						});

						for(var key in lmap) {
							lmap[key].sort((a, b) => b-a);
						}
						staff.sort((a, b) => {
							if (a.Level !== b.Level) {
								return b.Level - a.Level;
							} else {
								return a.normalisedLevel - b.normalisedLevel;
							}
						})
						var cStaff;
						var pStaff;
						var levelShift = 0;
						for(var i=0; i < staff.length; i++) {
							cStaff = staff[i];
							if (i > 0) {
								pStaff = staff[i-1];
								if (pStaff.Level === cStaff.Level && pStaff.normalisedLevel < cStaff.normalisedLevel) {
									levelShift++;
								}
							}
							cStaff.Level -= levelShift;
						}

						staff.forEach(s => {
							if (Array.isArray(s.Managers)) {
								if(s.Managers.length > 1){
									s.Managers.sort( (a, b) => {
										var x = (a.Level * 10 + a.roleOrder);
										var y =  (b.Level * 10 + b.roleOrder);
										if (x !== y) {
											return y - x;
										} else {
											if(a.Name < b.Name) return 1;
											if(a.Name > b.Name) return -1;
											return 0;												}
									});
									s.Managers.forEach((m, i) => {
										if (i > 0) {
											m.OtherManager = true;
										}
									});
								}
								s.Manager = s.Managers[0].id;
							}
						});
					}
				}
////
			} else {
				result = [];
			}
		}

		return result;		
		// bestMatch.subordinates.sort((a, b) => {
		// 	var x = (a.Level * 10 + a.roleOrder);
		// 	var y =  (b.Level * 10 + b.roleOrder);
		// 	if (x !== y) {
		// 		return x - y;
		// 	} else {
		// 		if(a.Name < b.Name) return -1;
		// 		if(a.Name > b.Name) return 1;
		// 		return 0;												}
		// });
	}

	function buildChart(staff, locationMappings, levelRoles, managers, buildOptions) {
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
					if (buildOptions.adminSearch) {
						s.Level = 1;
					}
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
				}
			});	
		} else {
			staff = buildChartBms(staff, locationMappings, levelRoles, managers, buildOptions);
		}

		//HG: Remove below line only for UAT
		staff = staff.filter(s => s.roleOrder !== null)

		staff = reverseLevels(staff);

		// HG: end Modified code

		// Order all staff based on role
		// HG: more efficient Code
		staff.sort((a,b) => a.roleOrder - b.roleOrder);
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

		var allStaff = [];

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

		renderChart(allStaff, locationMappings);

		// if (bestMatch) {
		// 	var bmCard = {x: bestMatch.Card.x, y: bestMatch.Card.y};
		// 	return bmCard;
		// }
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

		//requestAnimationFrame(function () {
		// container!
		group = draw.group()

		var locMapping = self.getLocationMapping(obj.Location);
		titleColour = locMapping.ocl_title;
		roleColour = locMapping.ocl_role;

		// Rectangle - card outline & background
		rect = group.rect(rectWidth, rectHeight)
			.move(x, y)
			.attr({ fill: locMapping.ocl_bg });

		if (obj.IsAssistant) {
			group.line(x - 31, y + 60, x, y + 60).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
			group.line(x - 30, y + 28, x - 30, y + 60).stroke({ width: 2 }).attr({ stroke: locMapping.ocl_bg });
		}

		// profile image
		//image = group.image("profile.png", imgW, imgH).move(x + 35, y - 35);
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
		/*
					group.on('mouseover', function (e) {
						if ($(group.node).find(e.fromElement).length == 0) {
							//window.console && console.log('mouseover', arguments);
							rect.animate(100, '<>').fill('#ffc423')
						}
					})
		
					group.on('mouseout', function (e) {
						if ($(group.node).find(e.toElement).length == 0) {
							//window.console && console.log('mouseout', arguments);
							rect.animate(100, '<>').fill(self.getLocationMapping(obj.Location))
						}
					})
		*/
		self.isDrawn = true;
		//})        
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
