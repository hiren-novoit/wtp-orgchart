	function addStaffManager(staff, manager){
		function addInSpList(staffId, managerId) {
			var managerListName = 'TestOrgChartManagers';
			var strUrl = _spPageContextInfo.webAbsoluteUrl + "/_api/web/lists/getbytitle('"+ managerListName +"')/items";

			var itemType = "SP.Data." + managerListName + "ListItem";///ListItemEntityTypeFullName
			var item = {
				"__metadata": { "type": itemType },
				m: managerId,
				s: staffId
			};
			var payload = payload;
			var strheader = {
				"accept": "application/json;odata=verbose",
				"X-RequestDigest": $("#__REQUESTDIGEST").val()
			};
			console.log(item)

			return $.ajax({
				url: strUrl,
				type: "POST",
				contentType: "application/json;odata=verbose",
				data: JSON.stringify(item),
				headers: strheader
			});
		}

		function AddListItem(listName, insertObject){
			var context = new SP.ClientContext.get_current(); // the current context is taken by default here
			//you can also create a particular site context as follows
			//var context = new SP.ClientContext('/Sites/site1');
			var lstObject = context.get_web().get_lists().getByTitle(listName);
			var listItemCreationInfo = new SP.ListItemCreationInformation();
			var newItem = lstObject.addItem(listItemCreationInfo);
			newItem.set_item('ocm_manager', insertObject.ocm_manager);
			newItem.set_item('ocm_staffmember', insertObject.ocm_staffmember);
			// set values to other columns of the list here
			newItem.update();
			context.executeQueryAsync(function(){
				console.log('Completed successfully.');
				}, function(sender, args) { 
					console.log(args.get_message()); 
					console.log(args.get_stackTrace()); 
				}
			);
		}

		function EnsureUserFn(logonName){
			logonName = 'i:0#.f|membership|'+ logonName + '@wtpartnership.com.au';
			var payload = { logonName };
			return $.ajax({
				url:_spPageContextInfo.webAbsoluteUrl + "/_api/web/ensureuser",
				type: "POST",
				contentType: "application/json;odata=verbose",
				async:false,
				data: JSON.stringify(payload),
				headers: {
					"accept": "application/json;odata=verbose",
					"X-RequestDigest": $("#__REQUESTDIGEST").val()
				}
			});
		}

		var staffPromise = EnsureUserFn(staff);
		var managerPromise = EnsureUserFn(manager);

		$.when(staffPromise, managerPromise).done(function(staffResult, managerResult){

			SP.SOD.executeFunc('sp.js', 'SP.ClientContext', function(){
				var ocm_staffmember = staffResult[0].d.Id;
				var ocm_manager = managerResult[0].d.Id
				var listName = 'Organisational Chart Managers';
				var setValues = {
					ocm_staffmember: ocm_staffmember,
					ocm_manager: ocm_manager
				}
				console.log(setValues);
				AddListItem(listName, setValues);
			});

		}).fail(function(error){
			console.log(error);
			console.log('Can not ensure user.');
			console.log('Can not add: ', staff, manager);
		});
    }
addStaffManager('sscales','cpeter');
addStaffManager('ymassie','cbarlow');
addStaffManager('jverkerk','cmchardy');
addStaffManager('lgow','dmcgregor');
addStaffManager('ama','dquincey');
addStaffManager('kpoon','dquincey');
addStaffManager('losborne','dstewart');
addStaffManager('jmorales','dthomas');
addStaffManager('awoolmer','gboyd');
addStaffManager('ldejong','gboyd');
addStaffManager('rhirst','gboyd');
addStaffManager('rchai','gboyd');
addStaffManager('wtan','gboyd');
addStaffManager('ythan','gboyd');
addStaffManager('ohou','gboyd');
addStaffManager('llodge','gboyd');
addStaffManager('cwong','gboyd');
addStaffManager('dtalevski','gboyd');
addStaffManager('dlambert','gboyd');
addStaffManager('tbotha','gboyd');
addStaffManager('ctough','ijamieson');
addStaffManager('mostapenko','imenzies');
addStaffManager('atan','imenzies');
addStaffManager('bbrowne','imenzies');
addStaffManager('cridout','imenzies');
addStaffManager('cwu','imenzies');
addStaffManager('dngo','imenzies');
addStaffManager('jpark','imenzies');
addStaffManager('pbaxendale','imenzies');
addStaffManager('sfoo','imenzies');
addStaffManager('rchoi','imenzies');
addStaffManager('kelau','imenzies');
addStaffManager('xwong','imenzies');
addStaffManager('thengngee','imenzies');
addStaffManager('jingmire','imenzies');
addStaffManager('ctough','jford');
addStaffManager('mpratt','josenton');
addStaffManager('jqu','josenton');
addStaffManager('wbinks','josenton');
addStaffManager('vha','josenton');
addStaffManager('dkadye','josenton');
addStaffManager('kqian','josenton');
addStaffManager('slei','josenton');
addStaffManager('rmaley','josenton');
addStaffManager('jschmerl','jthornley');
addStaffManager('mstanton-cook','jogorman');
addStaffManager('gmayor','kdavis');
addStaffManager('ckwong','kdavis');
addStaffManager('hzhang','kdavis');
addStaffManager('rrose','kdavis');
addStaffManager('aday','kdavis');
addStaffManager('rmartinez','kdavis');
addStaffManager('pdally','kdavis');
addStaffManager('klau','kdavis');
addStaffManager('shicks','kdavis');
addStaffManager('cchelliah','kdavis');
addStaffManager('jmorgan','kdavis');
addStaffManager('jallason','kdavis');
addStaffManager('dwilson','kdavis');
addStaffManager('cbarlow','kdavis');
addStaffManager('scowan','kdavis');
addStaffManager('dquincey','kdavis');
addStaffManager('mostapenko','mtebbatt');
addStaffManager('cmousseux','mtebbatt');
addStaffManager('atan','mtebbatt');
addStaffManager('bbrowne','mtebbatt');
addStaffManager('cridout','mtebbatt');
addStaffManager('cwu','mtebbatt');
addStaffManager('dngo','mtebbatt');
addStaffManager('jpark','mtebbatt');
addStaffManager('pbaxendale','mtebbatt');
addStaffManager('sfoo','mtebbatt');
addStaffManager('rchoi','mtebbatt');
addStaffManager('kelau','mtebbatt');
addStaffManager('xwong','mtebbatt');
addStaffManager('thengngee','mtebbatt');
addStaffManager('shennessy','ndeeks');
addStaffManager('rgroom','ndeeks');
addStaffManager('katfield','ndeeks');
addStaffManager('lshea','ndeeks');
addStaffManager('cperrin','ndeeks');
addStaffManager('sbolt','ndeeks');
addStaffManager('cbarlow','ndeeks');
addStaffManager('dquincey','ndeeks');
addStaffManager('rmaley','ndeeks');
addStaffManager('mmlee','pelphick');
addStaffManager('pfung','pelphick');
addStaffManager('cylee','pelphick');
addStaffManager('lbarreto','pelphick');
addStaffManager('mtaylor','pelphick');
addStaffManager('thartley','pelphick');
addStaffManager('ifrench','pelphick');
addStaffManager('jlum','pelphick');
addStaffManager('abuksh','pelphick');
addStaffManager('bomahony','pelphick');
addStaffManager('mmynarz','pelphick');
addStaffManager('amurphy','pelphick');
addStaffManager('scowan','pelphick');
addStaffManager('bkodela','psullivan');
addStaffManager('amclean','pgill');
addStaffManager('atsathas','ptaylorhill');
addStaffManager('gheaton','panseline');
addStaffManager('mbrown','panseline');
addStaffManager('ageorge','panseline');
addStaffManager('jwhitehouse','panseline');
addStaffManager('ptaylorhill','panseline');
addStaffManager('pdonovan','panseline');
addStaffManager('spremachandra','panseline');
addStaffManager('rng','panseline');
addStaffManager('agibson','panseline');
addStaffManager('eyan','panseline');
addStaffManager('cmousseux','panseline');
addStaffManager('abennier','spaddick');
addStaffManager('lcrilley','spaddick');
addStaffManager('arobertson','spaddick');
addStaffManager('jchen','spaddick');
addStaffManager('lhau','spaddick');
addStaffManager('mtromp','spaddick');
addStaffManager('slee','spaddick');
addStaffManager('tmolatedi','spaddick');
addStaffManager('hcheng','spaddick');
addStaffManager('aforte','spaddick');
addStaffManager('rwilliamson','spaddick');
addStaffManager('jturton','spaddick');
addStaffManager('mstanton-cook','sparrott');
addStaffManager('awoolmer','shensley');
addStaffManager('ldejong','shensley');
addStaffManager('rhirst','shensley');
addStaffManager('rchai','shensley');
addStaffManager('wtan','shensley');
addStaffManager('ythan','shensley');
addStaffManager('ohou','shensley');
addStaffManager('llodge','shensley');
addStaffManager('cwong','shensley');
addStaffManager('dtalevski','shensley');
addStaffManager('dlambert','shensley');
addStaffManager('tbotha','shensley');
addStaffManager('cdaubney','sbolt');
addStaffManager('pshah','shennessy');
addStaffManager('dmoodley','shennessy');
addStaffManager('nyadav','shennessy');
addStaffManager('hau','shennessy');
addStaffManager('tdelaney','shennessy');
addStaffManager('jingmire','shennessy');
addStaffManager('jmorales','sgillies');
addStaffManager('amclean','troberts');


	function recursiveDataCalls(getFunc, url) {
		var def = $.Deferred();
		// var firstCall = false;
		// var url;
		// if (typeof dataset === 'undefined') {
		// 	firstCall = true;
		// } else {
		// 	url = data['odata.nextLink'];
		// 	console.log('Url: ', url);
		// }
		// console.log('in first call', firstCall);
		// console.log(dataset);
		getFunc(url)
			.done(function (data) {
				console.log('get func resp: ', data);				
				console.log('get func resp value: ', data.value);
				if (data['odata.nextLink']) {
					console.log('found next url');
					console.log(data['odata.nextLink']);
					// recursiveDataCalls(getFunc, data).done(function(rcData){
					recursiveDataCalls(getFunc, data['odata.nextLink']).done(function(rcData){
						rcData.value.concat(data.value);
						def.resolve(rcData);
						// if (firstCall) {
						// 	console.log('In first call resolving concatenated dataset');
						// 	def.resolve(rcData)
						// } else {
						// 	def.resolve(data);
						// }
					}).fail(function (error) {
						console.log(error);
						def.reject(error);
					});
				} else {
					def.resolve(data);
				}
				// else if (firstCall) {
				// 	console.log('not found next url');
				// 	console.log('resolving data from get func');
				// 	def.resolve(data);
				// } else {
				// 	dataset.value.concat(data.value)
				// 	console.log('not found next url');
				// 	console.log('resolving ', dataset);
				// 	def.resolve(dataset);
				// }
			})
			.fail(function (error) {
				def.reject(error);
			})		
		return def.promise();
	}

var rcp = recursiveDataCalls(function (url) {
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
}).done(function(data){ 
		console.log(data);
		managers = data;
}).fail(function(error){
	console.log(error);
});
